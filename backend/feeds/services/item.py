"""
Item Service - 아이템(게시물) 관련 비즈니스 로직
"""

from typing import Optional
import logging

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet, Q
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

from feeds.models import RSSItem, RSSEverythingSource

logger = logging.getLogger(__name__)


class ItemService:
    """아이템 관련 비즈니스 로직을 처리하는 서비스"""

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
    def refresh_item(user, item_id: int) -> dict:
        """
        아이템을 새로고침 (상세 페이지 다시 크롤링)

        소스가 연결되어 있고 상세 페이지 스크래핑 설정이 있는 경우에만 가능
        """
        from feeds.services.source import SourceService
        from feeds.utils.html_utils import strip_html_tags
        from bs4 import BeautifulSoup
        from feeds.utils.html_parser import (
            extract_text,
            extract_html_with_css,
            extract_src,
        )

        item = get_object_or_404(RSSItem, id=item_id, feed__user=user)

        # 소스 확인: 아이템에 직접 연결된 소스 또는 피드의 첫 번째 소스 사용
        source = item.source
        if not source:
            source = item.feed.sources.first()

        if not source:
            return {
                "success": False,
                "error": "No source available for this item",
            }

        # 상세 페이지 셀렉터가 있는지 확인
        has_detail_selectors = any([
            source.detail_title_selector,
            source.detail_description_selector,
            source.detail_content_selector,
            source.detail_date_selector,
            source.detail_image_selector,
        ])

        if not has_detail_selectors:
            return {
                "success": False,
                "error": "No detail page selectors configured for this source",
            }

        try:
            # 상세 페이지 HTML 가져오기 (캐시 사용 안함 - 항상 최신 데이터 가져오기)
            fetch_result = SourceService.fetch_html(
                url=item.link,
                use_browser=source.use_browser,
                browser_service=source.browser_service or "realbrowser",
                wait_selector=source.wait_selector or "body",
                timeout=source.timeout or 30000,
                custom_headers=source.custom_headers,
                use_cache=False,
            )

            if not fetch_result.success or not fetch_result.html:
                return {
                    "success": False,
                    "error": fetch_result.error or "Failed to fetch page",
                }

            soup = BeautifulSoup(fetch_result.html, "html.parser")

            # exclude_selectors 적용
            if source.exclude_selectors:
                for exclude_selector in source.exclude_selectors:
                    for el in soup.select(exclude_selector):
                        el.decompose()

            updated_fields = []

            # 제목 업데이트
            if source.detail_title_selector:
                title_el = soup.select_one(source.detail_title_selector)
                if title_el:
                    new_title = extract_text(title_el)
                    if new_title and new_title != item.title:
                        item.title = new_title[:500]
                        updated_fields.append("title")

            # 설명/본문 업데이트
            content_selector = source.detail_content_selector or source.detail_description_selector
            if content_selector:
                content_el = soup.select_one(content_selector)
                if content_el:
                    new_description = extract_html_with_css(content_el, soup, item.link)
                    if new_description and new_description != item.description:
                        item.description = new_description
                        item.description_text = strip_html_tags(new_description)
                        updated_fields.append("description")
                        updated_fields.append("description_text")

            # 이미지 업데이트
            if source.detail_image_selector:
                img_el = soup.select_one(source.detail_image_selector)
                if img_el:
                    new_image = extract_src(img_el, item.link)
                    if new_image and new_image != item.image:
                        item.image = new_image
                        updated_fields.append("image")

            if updated_fields:
                item.save(update_fields=updated_fields)
                logger.info(f"Refreshed item {item_id}: updated {updated_fields}")

                # 이미지 캐시 스케줄링 (description이 업데이트된 경우)
                if "description" in updated_fields:
                    from feeds.tasks import precache_images_for_item
                    precache_images_for_item.delay(item.id)

            # 아이템 데이터 준비 (업데이트 여부와 상관없이 반환)
            item_data = {
                "id": item.id,
                "feed_id": item.feed_id,
                "source_id": item.source_id,
                "title": item.title,
                "link": item.link,
                "description": item.description,
                "author": item.author or "",
                "categories": item.categories or [],
                "image": item.image or "",
                "published_at": item.published_at,
                "is_read": item.is_read,
                "is_favorite": item.is_favorite,
            }

            return {
                "success": True,
                "updated_fields": updated_fields,
                "item": item_data,
                "message": f"Updated {len(updated_fields)} field(s)" if updated_fields else "No changes detected",
            }

        except Exception as e:
            logger.exception(f"Failed to refresh item {item_id}")
            return {
                "success": False,
                "error": str(e),
            }


    @staticmethod
    def list_all_items(
        user,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """메인 화면 아이템 목록"""
        items = RSSItem.objects.search(search).filter(feed__user=user).filter(
            feed__visible=True, feed__category__visible=True
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

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
        items = RSSItem.objects.search(search).filter(
            feed__user=user,
            feed__category_id=category_id,
            feed__visible=True,
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

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
        items = RSSItem.objects.search(search).filter(feed__user=user, feed_id=feed_id)

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        # items = ItemService._apply_search_filter(items, search)

        return items
