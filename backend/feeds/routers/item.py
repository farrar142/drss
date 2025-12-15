from typing import Optional
from ninja import Router
from ninja.pagination import paginate, PageNumberPagination

from django.shortcuts import get_object_or_404
from django.db import models

from base.authentications import JWTAuth
from feeds.models import RSSItem
from ..schemas import ItemSchema, PaginatedResponse

router = Router(auth=JWTAuth())


@router.put("/{item_id}/favorite")
def toggle_item_favorite(request, item_id: int):
    item = get_object_or_404(RSSItem, id=item_id, feed__user=request.auth)
    item.is_favorite = not item.is_favorite
    item.save()
    return {"success": True, "is_favorite": item.is_favorite}


@router.put("/{item_id}/read")
def toggle_item_read(request, item_id: int):
    item = get_object_or_404(RSSItem, id=item_id, feed__user=request.auth)
    item.is_read = not item.is_read
    item.save()
    return {"success": True, "is_read": item.is_read}


from django.db.models import QuerySet, Model


def get_paginated_items[T: Model](
    queryset: QuerySet[T],
    limit: int,
    cursor: Optional[str],
    direction: str,
    field_name: str,
):
    if cursor and cursor != "None":
        from datetime import datetime

        cursor_date = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
        if direction == "before":
            # Get older items (published_at < cursor), sorted newest first
            queryset = queryset.filter(**{f"{field_name}__lt": cursor_date})
            queryset = queryset.order_by(f"-{field_name}")
        elif direction == "after":
            # Get newer items (published_at > cursor), sorted oldest first
            # so pagination continues from where we left off
            queryset = queryset.filter(**{f"{field_name}__gt": cursor_date})
            queryset = queryset.order_by(field_name)
    else:
        # Default: newest first
        queryset = queryset.order_by(f"-{field_name}")

    # Get one extra item to check if there's a next page
    paginated_items = list(queryset[: limit + 1])
    has_next = len(paginated_items) > limit
    items_list = paginated_items[:limit]

    next_cursor = None
    if has_next and items_list:
        next_cursor_field = getattr(items_list[-1], field_name)
        if isinstance(next_cursor_field, str):
            next_cursor = next_cursor_field
        elif hasattr(next_cursor_field, "isoformat"):
            next_cursor = next_cursor_field.isoformat().replace("+00:00", "Z")
        else:
            next_cursor = str(next_cursor_field)

    return {
        "items": items_list,
        "has_next": has_next,
        "next_cursor": next_cursor,
    }


@router.get("/", response=PaginatedResponse[ItemSchema])
def list_all_items(
    request,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
    limit: int = 20,
    cursor: Optional[str] = None,
    direction: str = "before",  # "before" for older items, "after" for newer items
):
    # 메인 화면: Category.visible=False이거나 Feed.visible=False인 항목 제외
    items = RSSItem.objects.filter(feed__user=request.auth).filter(
        feed__visible=True, feed__category__visible=True
    )

    if is_read is not None:
        items = items.filter(is_read=is_read)
    if is_favorite is not None:
        items = items.filter(is_favorite=is_favorite)
    if search:
        items = items.filter(title__icontains=search) | items.filter(
            description__icontains=search
        )
    return get_paginated_items(
        items,
        limit,
        cursor,
        direction,
        field_name="published_at",
    )


@router.get("/category/{category_id}", response=PaginatedResponse[ItemSchema])
def list_items_by_category(
    request,
    category_id: int,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
    limit: int = 20,
    cursor: Optional[str] = None,
    direction: str = "before",
):
    # 카테고리 화면: Feed.visible=False인 항목만 제외 (Category.visible은 무시)
    items = RSSItem.objects.filter(
        feed__user=request.auth,
        feed__category_id=category_id,
        feed__visible=True,
    )

    if is_read is not None:
        items = items.filter(is_read=is_read)
    if is_favorite is not None:
        items = items.filter(is_favorite=is_favorite)
    if search:
        items = items.filter(title__icontains=search) | items.filter(
            description__icontains=search
        )
    return get_paginated_items(
        items,
        limit,
        cursor,
        direction,
        field_name="published_at",
    )


@router.get("/feed/{feed_id}", response=PaginatedResponse[ItemSchema])
def list_items_by_feed(
    request,
    feed_id: int,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
    limit: int = 20,
    cursor: Optional[str] = None,
    direction: str = "before",
):
    items = RSSItem.objects.filter(feed__user=request.auth, feed_id=feed_id)

    if is_read is not None:
        items = items.filter(is_read=is_read)
    if is_favorite is not None:
        items = items.filter(is_favorite=is_favorite)
    if search:
        items = items.filter(title__icontains=search) | items.filter(
            description__icontains=search
        )
    return get_paginated_items(
        items,
        limit,
        cursor,
        direction,
        field_name="published_at",
    )
