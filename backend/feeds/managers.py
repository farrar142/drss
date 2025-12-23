from django.db import models
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

class RSSFeedWithCountManager(models.Manager):
    """item_count가 annotated된 쿼리셋을 반환하는 커스텀 매니저"""
    def with_item_counts(self):
      return self.annotate(
            item_count=models.Count("rssitem", filter=models.Q(rssitem__is_read=False))
        )

class RSSItemManager[T:models.Model](models.Manager):
    def search(self, search)->models.QuerySet[T]:
        if not search:
            return self

        search = search.strip()

        # 전문 검색 벡터 (config='simple'로 언어 독립적 검색)
        # description_text는 HTML 태그가 제거된 순수 텍스트
        search_vector = SearchVector("title", weight="A", config="simple") + SearchVector(
            "description_text", weight="B", config="simple"
        )
        search_query = SearchQuery(search, config="simple", search_type="plain")

        # 하이브리드: 전문 검색 OR icontains
        # 전문 검색이 실패해도 icontains로 매칭 가능
        return (
            self.annotate(
                search=search_vector,
                rank=SearchRank(search_vector, search_query),
            )
            .filter(
                models.Q(search=search_query) |  # 전문 검색 매칭
                models.Q(title__icontains=search) |  # 제목 부분 문자열
                models.Q(description_text__icontains=search)  # 설명 부분 문자열 (HTML 제거된 텍스트)
            )
            .order_by("-rank", "-published_at")  # 관련도 순, 동점이면 최신순
            .distinct()
        )
