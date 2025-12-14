from typing import Optional
from ninja import Router

from django.shortcuts import get_object_or_404

from base.authentications import JWTAuth
from feeds.models import RSSItem
from ..schemas import ItemSchema

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


@router.get("/", response=list[ItemSchema])
def list_all_items(
    request,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
):
    items = RSSItem.objects.filter(feed__user=request.auth)

    if is_read is not None:
        items = items.filter(is_read=is_read)
    if is_favorite is not None:
        items = items.filter(is_favorite=is_favorite)
    if search:
        items = items.filter(title__icontains=search) | items.filter(
            description__icontains=search
        )

    items = items.order_by("-published_at")

    # Convert to list and format published_at as string
    result = []
    for item in items:
        result.append(
            {
                "id": item.pk,
                "feed_id": item.feed_id,
                "title": item.title,
                "link": item.link,
                "description": item.description,
                "published_at": item.published_at.isoformat(),
                "is_read": item.is_read,
                "is_favorite": item.is_favorite,
            }
        )

    return result
