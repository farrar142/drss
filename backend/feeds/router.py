from ninja import Schema, Router
from typing import List
from django.shortcuts import get_object_or_404
from feeds.models import RSSCategory, RSSFeed, RSSItem
from base.authentications import JWTAuth

router = Router()


class CategorySchema(Schema):
    id: int
    name: str
    description: str


class CategoryCreateSchema(Schema):
    name: str
    description: str = ""


class FeedSchema(Schema):
    id: int
    category_id: int
    url: str
    title: str
    description: str
    visible: bool
    last_updated: str


class FeedCreateSchema(Schema):
    category_id: int
    url: str
    title: str
    description: str = ""
    visible: bool = True


class ItemSchema(Schema):
    id: int
    title: str
    link: str
    description: str
    published_at: str
    is_read: bool
    is_favorite: bool


@router.get("/categories", response=List[CategorySchema], auth=JWTAuth())
def list_categories(request):
    categories = RSSCategory.objects.filter(user=request.auth)
    return categories


@router.post("/categories", response=CategorySchema, auth=JWTAuth())
def create_category(request, data: CategoryCreateSchema):
    category = RSSCategory.objects.create(
        user=request.auth, name=data.name, description=data.description
    )
    return category


@router.put("/categories/{category_id}", response=CategorySchema, auth=JWTAuth())
def update_category(request, category_id: int, data: CategoryCreateSchema):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    category.name = data.name
    category.description = data.description
    category.save()
    return category


@router.delete("/categories/{category_id}", auth=JWTAuth())
def delete_category(request, category_id: int):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    category.delete()
    return {"success": True}


@router.get("/feeds", response=List[FeedSchema], auth=JWTAuth())
def list_feeds(request):
    feeds = RSSFeed.objects.filter(user=request.auth)
    return feeds


@router.post("/feeds", response=FeedSchema, auth=JWTAuth())
def create_feed(request, data: FeedCreateSchema):
    category = get_object_or_404(RSSCategory, id=data.category_id, user=request.auth)

    feed = RSSFeed.objects.create(
        user=request.auth,
        category=category,
        url=data.url,
        title=data.title,
        description=data.description,
        visible=data.visible,
    )
    return feed


@router.delete("/feeds/{feed_id}", auth=JWTAuth())
def delete_feed(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    feed.delete()
    return {"success": True}


@router.get("/feeds/{feed_id}/items", response=List[ItemSchema], auth=JWTAuth())
def list_feed_items(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    items = RSSItem.objects.filter(feed=feed)
    return items


@router.put("/items/{item_id}/read", auth=JWTAuth())
def mark_item_read(request, item_id: int):
    item = get_object_or_404(RSSItem, id=item_id, feed__user=request.auth)
    item.is_read = True
    item.save()
    return {"success": True}


@router.put("/items/{item_id}/favorite", auth=JWTAuth())
def toggle_item_favorite(request, item_id: int):
    item = get_object_or_404(RSSItem, id=item_id, feed__user=request.auth)
    item.is_favorite = not item.is_favorite
    item.save()
    return {"success": True, "is_favorite": item.is_favorite}
