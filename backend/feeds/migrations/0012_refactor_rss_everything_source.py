# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("feeds", "0011_add_custom_headers_to_rsseverythingsource"),
    ]

    operations = [
        # 기존 테이블 삭제 (데이터 없음)
        migrations.DeleteModel(
            name="RSSEverythingSource",
        ),
        # 새 모델 생성
        migrations.CreateModel(
            name="RSSEverythingSource",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("url", models.URLField(help_text="크롤링할 페이지 URL")),
                (
                    "item_selector",
                    models.CharField(
                        help_text="아이템 목록의 CSS 셀렉터 (예: article.post, .news-item)",
                        max_length=500,
                    ),
                ),
                (
                    "title_selector",
                    models.CharField(
                        help_text="제목 CSS 셀렉터 (아이템 내부)", max_length=500
                    ),
                ),
                (
                    "link_selector",
                    models.CharField(
                        blank=True,
                        help_text="링크 CSS 셀렉터 (아이템 내부, 비워두면 title_selector의 a 태그 사용)",
                        max_length=500,
                    ),
                ),
                (
                    "description_selector",
                    models.CharField(
                        blank=True,
                        help_text="설명 CSS 셀렉터 (아이템 내부)",
                        max_length=500,
                    ),
                ),
                (
                    "date_selector",
                    models.CharField(
                        blank=True,
                        help_text="날짜 CSS 셀렉터 (아이템 내부)",
                        max_length=500,
                    ),
                ),
                (
                    "image_selector",
                    models.CharField(
                        blank=True,
                        help_text="이미지 CSS 셀렉터 (아이템 내부)",
                        max_length=500,
                    ),
                ),
                (
                    "follow_links",
                    models.BooleanField(
                        default=False,
                        help_text="각 아이템의 링크를 따라가서 상세 내용을 가져올지 여부",
                    ),
                ),
                (
                    "detail_title_selector",
                    models.CharField(
                        blank=True,
                        help_text="상세 페이지에서 제목 CSS 셀렉터",
                        max_length=500,
                    ),
                ),
                (
                    "detail_description_selector",
                    models.CharField(
                        blank=True,
                        help_text="상세 페이지에서 설명/요약 CSS 셀렉터",
                        max_length=500,
                    ),
                ),
                (
                    "detail_content_selector",
                    models.CharField(
                        blank=True,
                        help_text="상세 페이지에서 본문 CSS 셀렉터",
                        max_length=500,
                    ),
                ),
                (
                    "detail_date_selector",
                    models.CharField(
                        blank=True,
                        help_text="상세 페이지에서 날짜 CSS 셀렉터",
                        max_length=500,
                    ),
                ),
                (
                    "detail_image_selector",
                    models.CharField(
                        blank=True,
                        help_text="상세 페이지에서 이미지 CSS 셀렉터",
                        max_length=500,
                    ),
                ),
                (
                    "date_format",
                    models.CharField(
                        blank=True,
                        help_text="날짜 포맷 (예: %Y-%m-%d, %Y.%m.%d)",
                        max_length=100,
                    ),
                ),
                (
                    "date_locale",
                    models.CharField(
                        default="ko_KR",
                        help_text="날짜 로케일 (예: ko_KR, en_US)",
                        max_length=20,
                    ),
                ),
                (
                    "use_browser",
                    models.BooleanField(
                        default=True,
                        help_text="브라우저 렌더링 사용 여부 (JavaScript 필요 시)",
                    ),
                ),
                (
                    "wait_selector",
                    models.CharField(
                        blank=True,
                        help_text="페이지 로드 완료 확인용 셀렉터",
                        max_length=500,
                    ),
                ),
                (
                    "timeout",
                    models.IntegerField(default=30000, help_text="타임아웃 (밀리초)"),
                ),
                ("last_crawled_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "feed",
                    models.OneToOneField(
                        help_text="연결된 RSS 피드",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="rss_everything_source",
                        to="feeds.rssfeed",
                    ),
                ),
            ],
            options={
                "verbose_name": "RSS Everything Source",
                "verbose_name_plural": "RSS Everything Sources",
            },
        ),
        migrations.AddIndex(
            model_name="rsseverythingsource",
            index=models.Index(fields=["feed"], name="feeds_rssev_feed_id_d17aa8_idx"),
        ),
    ]
