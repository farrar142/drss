# Generated manually

from django.db import migrations, models
import django.db.models.deletion


def migrate_rss_feeds_to_sources(apps, schema_editor):
    """
    기존 RSSFeed의 url과 custom_headers를 RSSEverythingSource로 이전합니다.
    기존에 RSSEverythingSource가 없는 피드는 RSS 타입으로 소스를 생성합니다.
    기존 RSSEverythingSource가 있는 피드는 source_type을 적절히 설정합니다.
    """
    RSSFeed = apps.get_model("feeds", "RSSFeed")
    RSSEverythingSource = apps.get_model("feeds", "RSSEverythingSource")

    for feed in RSSFeed.objects.all():
        # 기존 RSSEverythingSource가 있는지 확인 (1:1 관계였으므로)
        existing_source = RSSEverythingSource.objects.filter(feed=feed).first()

        if existing_source:
            # 기존 소스가 있으면 source_type 설정
            # follow_links가 True면 DETAIL_PAGE_SCRAPING, 아니면 PAGE_SCRAPING
            if existing_source.follow_links_old:
                existing_source.source_type = "detail_page_scraping"
            else:
                existing_source.source_type = "page_scraping"
            existing_source.is_active = True
            # custom_headers가 비어있으면 feed에서 복사
            if not existing_source.custom_headers:
                existing_source.custom_headers = feed.custom_headers_old or {}
            existing_source.save()
        else:
            # 기존 소스가 없으면 RSS 타입으로 새 소스 생성
            RSSEverythingSource.objects.create(
                feed=feed,
                source_type="rss",
                is_active=True,
                url=feed.url_old or "",
                custom_headers=feed.custom_headers_old or {},
                use_browser=False,
            )


def reverse_migrate(apps, schema_editor):
    """역마이그레이션: 첫 번째 소스의 url을 feed로 복원"""
    RSSFeed = apps.get_model("feeds", "RSSFeed")
    RSSEverythingSource = apps.get_model("feeds", "RSSEverythingSource")

    for feed in RSSFeed.objects.all():
        source = RSSEverythingSource.objects.filter(feed=feed).first()
        if source:
            feed.url_old = source.url
            feed.custom_headers_old = source.custom_headers
            feed.save()


class Migration(migrations.Migration):
    # PostgreSQL trigger 문제 방지를 위해 atomic=False 설정
    atomic = False

    dependencies = [
        ("feeds", "0016_add_feed_task_result"),
    ]

    operations = [
        # 1. RSSFeed에서 url, custom_headers 필드 이름을 임시로 변경
        migrations.RenameField(
            model_name="rssfeed",
            old_name="url",
            new_name="url_old",
        ),
        migrations.RenameField(
            model_name="rssfeed",
            old_name="custom_headers",
            new_name="custom_headers_old",
        ),
        # 2. RSSEverythingSource에 새 필드 추가
        migrations.AddField(
            model_name="rsseverythingsource",
            name="source_type",
            field=models.CharField(
                choices=[
                    ("rss", "RSS/Atom (Classic)"),
                    ("page_scraping", "Page Scraping"),
                    ("detail_page_scraping", "Detail Page Scraping"),
                ],
                default="rss",
                help_text="소스 타입 (RSS/Atom, 페이지 스크래핑, 상세 페이지 스크래핑)",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="rsseverythingsource",
            name="is_active",
            field=models.BooleanField(default=True, help_text="이 소스의 활성화 여부"),
        ),
        migrations.AddField(
            model_name="rsseverythingsource",
            name="custom_headers",
            field=models.JSONField(blank=True, default=dict),
        ),
        # 3. follow_links 필드 이름 변경 (property로 대체되므로)
        migrations.RenameField(
            model_name="rsseverythingsource",
            old_name="follow_links",
            new_name="follow_links_old",
        ),
        # 4. item_selector를 blank=True로 변경 (RSS 타입은 필요 없음)
        migrations.AlterField(
            model_name="rsseverythingsource",
            name="item_selector",
            field=models.CharField(
                blank=True,
                help_text="아이템 목록의 CSS 셀렉터 (예: article.post, .news-item)",
                max_length=500,
            ),
        ),
        migrations.AlterField(
            model_name="rsseverythingsource",
            name="title_selector",
            field=models.CharField(
                blank=True, help_text="제목 CSS 셀렉터 (아이템 내부)", max_length=500
            ),
        ),
        # 5. ForeignKey로 변경 (OneToOneField -> ForeignKey)
        migrations.AlterField(
            model_name="rsseverythingsource",
            name="feed",
            field=models.ForeignKey(
                help_text="연결된 RSS 피드",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sources",
                to="feeds.rssfeed",
            ),
        ),
        # 6. 인덱스 추가
        migrations.AddIndex(
            model_name="rsseverythingsource",
            index=models.Index(
                fields=["feed", "source_type"], name="feeds_rssev_feed_id_source_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="rsseverythingsource",
            index=models.Index(
                fields=["feed", "is_active"], name="feeds_rssev_feed_id_active_idx"
            ),
        ),
        # 7. 데이터 마이그레이션: 기존 RSSFeed를 RSSEverythingSource로 변환
        migrations.RunPython(migrate_rss_feeds_to_sources, reverse_migrate),
        # 8. 임시 필드 제거
        migrations.RemoveField(
            model_name="rssfeed",
            name="url_old",
        ),
        migrations.RemoveField(
            model_name="rssfeed",
            name="custom_headers_old",
        ),
        migrations.RemoveField(
            model_name="rsseverythingsource",
            name="follow_links_old",
        ),
        # 9. use_browser 기본값 변경
        migrations.AlterField(
            model_name="rsseverythingsource",
            name="use_browser",
            field=models.BooleanField(
                default=False,
                help_text="브라우저 렌더링 사용 여부 (JavaScript 필요 시)",
            ),
        ),
    ]
