"""
Item Router - 아이템 관련 API 엔드포인트
"""

from typing import Optional

from ninja import Router
from ninja.pagination import paginate
from django.http import HttpResponse
from ninja.errors import HttpError

from base.authentications import JWTAuth, async_jwt
from base.paginations import AsyncCursorPagination
from feeds.models import RSSItem, RSSFeed, RSSCategory
from feeds.services import ItemService
from feeds.schemas import ItemSchema, ItemRefreshResponse
from feeds.utils.rss_generator import generate_rss_xml, generate_atom_xml

router = Router(tags=["items"], auth=async_jwt)


@router.post(
    "/{item_id}/refresh", response=ItemRefreshResponse, operation_id="refreshItem"
)
async def refresh_item(request, item_id: int):
    """아이템 새로고침 (상세 페이지 다시 크롤링)"""
    item, fields = await ItemService.refresh_item(request.auth, item_id)
    return dict(success=True, updated_fields=fields, item=item)


@router.put("/{item_id}/favorite", operation_id="toggleItemFavorite")
async def toggle_item_favorite(request, item_id: int):
    """아이템 즐겨찾기 토글"""
    return ItemService.toggle_favorite(request.auth, item_id)


@router.put("/{item_id}/read", operation_id="toggleItemRead")
async def toggle_item_read(request, item_id: int):
    """아이템 읽음 상태 토글"""
    return ItemService.toggle_read(request.auth, item_id)


@router.delete("/{item_id}", operation_id="deleteItem")
async def delete_item(request, item_id: int):
    """아이템 삭제"""
    await ItemService.delete_item(request.auth, item_id)
    return {"success": True}


@router.get("", response=list[ItemSchema], operation_id="listAllItems")
@paginate(AsyncCursorPagination[RSSItem], ordering_field="published_at")
async def list_all_items(
    request,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
):
    """메인 화면 아이템 목록"""
    return ItemService.list_all_items(request.auth, is_read, is_favorite, search)


@router.get(
    "/category/{category_id}",
    response=list[ItemSchema],
    operation_id="listItemsByCategory",
)
@paginate(AsyncCursorPagination[RSSItem], ordering_field="published_at")
async def list_items_by_category(
    request,
    category_id: int,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
):
    """카테고리별 아이템 목록"""
    return ItemService.list_items_by_category(
        request.auth,
        category_id,
        is_read,
        is_favorite,
        search,
    )


@router.get(
    "/feed/{feed_id}", response=list[ItemSchema], operation_id="listItemsByFeed"
)
@paginate(AsyncCursorPagination[RSSItem], ordering_field="published_at")
async def list_items_by_feed(
    request,
    feed_id: int,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
):
    """피드별 아이템 목록"""
    return ItemService.list_items_by_feed(
        request.auth, feed_id, is_read, is_favorite, search
    )


# ============== RSS/Atom Feed Export Endpoints ==============


@router.get("/rss", auth=None, operation_id="exportAllItemsRss")
async def export_all_items_rss(
    request,
    page: int = 1,
    page_size: int = 50,
    format: str = "rss",
):
    """공개된 카테고리/피드의 아이템을 RSS/Atom 피드로 내보내기 (인증 불필요)"""
    offset = (page - 1) * page_size

    items = [
        item
        async for item in RSSItem.objects.filter(
            feed__is_public=True,
            feed__category__is_public=True,
        ).order_by("-published_at")[offset : offset + page_size]
    ]
    print(items)
    title = "DRSS - Public Items"
    link = "https://drss.app/"
    description = "Public RSS items from DRSS"

    if format == "atom":
        xml_content = generate_atom_xml(items, title, link, "all-public")
        content_type = "application/atom+xml; charset=utf-8"
    else:
        xml_content = generate_rss_xml(items, title, link, description)
        content_type = "application/rss+xml; charset=utf-8"

    return HttpResponse(xml_content, content_type=content_type)


@router.get(
    "/category/{category_id}/rss", auth=None, operation_id="exportCategoryItemsRss"
)
async def export_category_items_rss(
    request,
    category_id: int,
    page: int = 1,
    page_size: int = 50,
    format: str = "rss",
):
    """공개된 카테고리의 공개 피드 아이템을 RSS/Atom 피드로 내보내기 (인증 불필요)"""
    category = await RSSCategory.objects.filter(id=category_id, is_public=True).afirst()
    if not category:
        raise HttpError(404, "Category not found or not public")

    offset = (page - 1) * page_size

    items = [
        item
        async for item in RSSItem.objects.filter(
            feed__category_id=category_id,
            feed__is_public=True,
        ).order_by("-published_at")[offset : offset + page_size]
    ]

    title = f"DRSS - {category.name}"
    link = f"https://drss.app/category/{category_id}"
    description = f"Public RSS items from category: {category.name}"

    if format == "atom":
        xml_content = generate_atom_xml(items, title, link, f"category-{category_id}")
        content_type = "application/atom+xml; charset=utf-8"
    else:
        xml_content = generate_rss_xml(items, title, link, description)
        content_type = "application/rss+xml; charset=utf-8"

    return HttpResponse(xml_content, content_type=content_type)


@router.get("/feed/{feed_id}/rss", auth=None, operation_id="exportFeedItemsRss")
async def export_feed_items_rss(
    request,
    feed_id: int,
    page: int = 1,
    page_size: int = 50,
    format: str = "rss",
):
    """공개된 피드의 아이템을 RSS/Atom 피드로 내보내기 (인증 불필요)"""
    feed = await RSSFeed.objects.filter(
        id=feed_id,
        is_public=True,
        category__is_public=True,
    ).afirst()
    if not feed:
        raise HttpError(404, "Feed not found or not public")

    offset = (page - 1) * page_size

    items = [
        item
        async for item in RSSItem.objects.filter(feed_id=feed_id).order_by(
            "-published_at"
        )[offset : offset + page_size]
    ]

    title = f"DRSS - {feed.title}"
    link = f"https://drss.app/feed/{feed_id}"
    description = f"RSS items from feed: {feed.title}"

    if format == "atom":
        xml_content = generate_atom_xml(items, title, link, f"feed-{feed_id}")
        content_type = "application/atom+xml; charset=utf-8"
    else:
        xml_content = generate_rss_xml(items, title, link, description)
        content_type = "application/rss+xml; charset=utf-8"

    return HttpResponse(xml_content, content_type=content_type)


@router.delete("/{item_id}", auth=JWTAuth(), operation_id="deleteItem")
async def delete_item(request, item_id: int):
    """아이템 삭제"""
    await ItemService.delete_item(request.auth, item_id)
    return {"success": True}
