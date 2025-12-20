# Generated manually for data migration

import re
from html import unescape
from django.db import migrations


def strip_html_tags(html: str) -> str:
    """HTML 문자열에서 태그를 제거하고 순수 텍스트만 반환합니다."""
    if not html:
        return ""

    # script, style 태그와 그 내용 제거
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # HTML 주석 제거
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # 모든 HTML 태그 제거
    text = re.sub(r'<[^>]+>', ' ', text)

    # HTML 엔티티 디코딩 (예: &amp; -> &, &lt; -> <)
    text = unescape(text)

    # 연속된 공백을 단일 공백으로
    text = re.sub(r'\s+', ' ', text)

    # 앞뒤 공백 제거
    return text.strip()


def migrate_description_to_description_text(apps, schema_editor):
    """기존 description 필드의 값에서 HTML 태그를 제거하여 description_text로 마이그레이션"""
    RSSItem = apps.get_model('feeds', 'RSSItem')

    # 배치 처리 (메모리 효율성)
    batch_size = 1000
    total = RSSItem.objects.count()
    processed = 0

    print(f"\nMigrating {total} RSSItem records...")

    while processed < total:
        # 배치로 불러오기
        items = list(RSSItem.objects.all()[processed:processed + batch_size])
        if not items:
            break

        # 각 아이템의 description_text 업데이트
        for item in items:
            item.description_text = strip_html_tags(item.description)

        # 배치 업데이트
        RSSItem.objects.bulk_update(items, ['description_text'], batch_size=batch_size)

        processed += len(items)
        print(f"  Processed {processed}/{total} records...")

    print(f"Migration complete! Processed {processed} records.\n")


def reverse_migration(apps, schema_editor):
    """역방향 마이그레이션 - description_text를 빈 문자열로 초기화"""
    RSSItem = apps.get_model('feeds', 'RSSItem')
    RSSItem.objects.update(description_text='')


class Migration(migrations.Migration):

    dependencies = [
        ('feeds', '0011_add_description_text_field'),
    ]

    operations = [
        migrations.RunPython(
            migrate_description_to_description_text,
            reverse_code=reverse_migration,
        ),
    ]
