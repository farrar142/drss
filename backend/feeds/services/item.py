"""
Item Service - 아이템(게시물) 관련 비즈니스 로직
"""

from typing import Optional

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet, Q
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

from feeds.models import RSSItem


class ItemService:
    """아이템 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def _apply_search_filter(
        queryset: QuerySet[RSSItem], search: str
    ) -> QuerySet[RSSItem]:
        """
        검색 필터 적용 - PostgreSQL 전문 검색 + icontains 하이브리드
        
        1. 전문 검색 (SearchVector): 단어 단위 검색으로 관련도 랭킹
        2. icontains: 부분 문자열 매칭 (한국어/특수문자에 효과적)
        
        두 방식을 OR로 결합하여 어느 쪽이든 매칭되면 결과에 포함
        """
        if not search:
            return queryset

        search = search.strip()

        # 전문 검색 벡터 (config='simple'로 언어 독립적 검색)
        search_vector = SearchVector("title", weight="A", config="simple") + SearchVector(
            "description", weight="B", config="simple"
        )
        search_query = SearchQuery(search, config="simple", search_type="plain")

        # 하이브리드: 전문 검색 OR icontains
        # 전문 검색이 실패해도 icontains로 매칭 가능
        return (
            queryset.annotate(
                search=search_vector,
                rank=SearchRank(search_vector, search_query),
            )
            .filter(
                Q(search=search_query) |  # 전문 검색 매칭
                Q(title__icontains=search) |  # 제목 부분 문자열
                Q(description__icontains=search)  # 설명 부분 문자열
            )
            .order_by("-rank", "-published_at")  # 관련도 순, 동점이면 최신순
            .distinct()
        )

    @staticmethod
    def toggle_favorite(user, item_id: int) -> dict:
        """아이템 즐겨찾기 토글"""
        item = get_object_or_404(RSSItem, id=item_id, feed__user=user)
        item.is_favorite = not item.is_favorite
        item.save()
        return {"success": True, "is_favorite": item.is_favorite}

    @staticmethod
    def toggle_read(user, item_id: int) -> dict:
        """아이템 읽음 상태 토글"""
        item = get_object_or_404(RSSItem, id=item_id, feed__user=user)
        item.is_read = not item.is_read
        item.save()
        return {"success": True, "is_read": item.is_read}


    @staticmethod
    def list_all_items(
        user,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """메인 화면 아이템 목록"""
        items = RSSItem.objects.filter(feed__user=user).filter(
            feed__visible=True, feed__category__visible=True
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        items = ItemService._apply_search_filter(items, search)

        return items

    @staticmethod
    def list_items_by_category(
        user,
        category_id: int,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """카테고리별 아이템 목록"""
        items = RSSItem.objects.filter(
            feed__user=user,
            feed__category_id=category_id,
            feed__visible=True,
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        items = ItemService._apply_search_filter(items, search)

        return items

    @staticmethod
    def list_items_by_feed(
        user,
        feed_id: int,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """피드별 아이템 목록"""
        items = RSSItem.objects.filter(feed__user=user, feed_id=feed_id)

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        items = ItemService._apply_search_filter(items, search)

        return items
