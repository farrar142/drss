# TODO

## 백엔드 성능 최적화

### PostgreSQL GIN 인덱스 추가
전문 검색 성능 향상을 위해 GIN 인덱스 추가 필요

```sql
-- RSSItem 전문 검색 인덱스
CREATE INDEX idx_rssitem_search ON feeds_rssitem 
USING GIN(to_tsvector('simple', title || ' ' || description));

-- 또는 Django migration으로 추가:
-- migrations/xxxx_add_search_index.py
```

Django Migration 예시:
```python
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('feeds', 'xxxx_previous'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX idx_rssitem_search 
            ON feeds_rssitem 
            USING GIN(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_rssitem_search;",
        ),
    ]
```

### 참고 문서
- [Django PostgreSQL Full Text Search](https://docs.djangoproject.com/en/6.0/ref/contrib/postgres/search/)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
