"""
Feeds Router - 모든 피드 관련 API 엔드포인트
"""

from typing import Optional
from ninja import Router
from ninja.pagination import paginate
from django.http import HttpResponse

from base.authentications import JWTAuth
from base.paginations import CursorPagination
from feeds.models import RSSItem, FeedTaskResult, RSSFeed, RSSCategory
from feeds.services import (
    CategoryService,
    FeedService,
    ItemService,
    SourceService,
    TaskResultService,
    PeriodicTaskService,
)
from feeds.schemas import (
    # Category
    CategorySchema,
    CategoryCreateSchema,
    CategoryUpdateSchema,
    CategoryReorderSchema,
    # Feed
    FeedSchema,
    FeedCreateSchema,
    FeedUpdateSchema,
    FeedValidationRequest,
    FeedValidationResponse,
    # Source / RSS Everything
    SourceSchema,
    SourceCreateSchema,
    SourceUpdateSchema,
    FetchHTMLRequest,
    FetchHTMLResponse,
    ElementInfo,
    ExtractElementsRequest,
    ExtractElementsResponse,
    PreviewItem,
    PreviewItemRequest,
    PreviewItemResponse,
    RSSEverythingSchema,
    RSSEverythingCreateRequest,
    RSSEverythingUpdateRequest,
    RefreshResponse,
    # Item
    ItemSchema,
    PaginatedResponse,
    # Task Result
    FeedInfo,
    TaskResultSchema,
    TaskResultListResponse,
    TaskStatsSchema,
    # Periodic Task
    PeriodicTaskSchema,
    PeriodicTaskListResponse,
    PeriodicTaskUpdateSchema,
)


# ============== Routers ==============

category_router = Router(tags=["categories"])
feed_router = Router(tags=["feeds"])
item_router = Router(tags=["items"], auth=JWTAuth())
source_router = Router(tags=["rss-everything"])
task_result_router = Router(tags=["task-results"])
periodic_task_router = Router(tags=["periodic-tasks"])


# ============== Category Endpoints ==============


@category_router.get("", response=list[CategorySchema], auth=JWTAuth())
def list_categories(request):
    """카테고리 목록 조회"""
    return CategoryService.get_user_categories(request.auth)


@category_router.post("", response=CategorySchema, auth=JWTAuth())
def create_category(request, data: CategoryCreateSchema):
    """카테고리 생성"""
    return CategoryService.create_category(request.auth, data)


@category_router.put("/{category_id}", response=CategorySchema, auth=JWTAuth())
def update_category(request, category_id: int, data: CategoryUpdateSchema):
    """카테고리 수정"""
    return CategoryService.update_category(request.auth, category_id, data)


@category_router.post("/reorder", response=list[CategorySchema], auth=JWTAuth())
def reorder_categories(request, data: CategoryReorderSchema):
    """카테고리 순서 일괄 변경"""
    return CategoryService.reorder_categories(request.auth, data)


@category_router.delete("/{category_id}", auth=JWTAuth())
def delete_category(request, category_id: int):
    """카테고리 삭제"""
    CategoryService.delete_category(request.auth, category_id)
    return {"success": True}


@category_router.post("/{category_id}/refresh", auth=JWTAuth())
def refresh_category_feeds(request, category_id: int):
    """카테고리의 모든 피드 새로고침"""
    CategoryService.refresh_category_feeds(request.auth, category_id)
    return {"success": True, "message": "Category feeds refresh scheduled"}


@category_router.get("/{category_id}/stats", auth=JWTAuth())
def get_category_stats(request, category_id: int):
    """카테고리 통계 조회"""
    return CategoryService.get_category_stats(request.auth, category_id)


# ============== Feed Endpoints ==============


@feed_router.post("/validate", response=FeedValidationResponse, auth=JWTAuth())
def validate_feed(request, data: FeedValidationRequest):
    """RSS 피드 URL 검증"""
    try:
        return FeedService.validate_feed(data)
    except Exception as e:
        from ninja.errors import HttpError

        raise HttpError(400, f"Failed to validate feed: {str(e)}")


@feed_router.get("", response=list[FeedSchema], auth=JWTAuth())
def list_feeds(request):
    """피드 목록 조회"""
    return FeedService.get_user_feeds(request.auth)


@feed_router.post("", response=FeedSchema, auth=JWTAuth())
def create_feed(request, data: FeedCreateSchema):
    """피드 생성"""
    return FeedService.create_feed(request.auth, data)


@feed_router.put("/{feed_id}", response=FeedSchema, auth=JWTAuth())
def update_feed(request, feed_id: int, data: FeedUpdateSchema):
    """피드 수정"""
    return FeedService.update_feed(request.auth, feed_id, data)


@feed_router.delete("/{feed_id}", auth=JWTAuth())
def delete_feed(request, feed_id: int):
    """피드 삭제"""
    FeedService.delete_feed(request.auth, feed_id)
    return {"success": True}


@feed_router.post("/{feed_id}/refresh", auth=JWTAuth())
def refresh_feed(request, feed_id: int):
    """피드 새로고침"""
    return FeedService.refresh_feed(request.auth, feed_id)


@feed_router.put("/{feed_id}/mark-all-read", auth=JWTAuth())
def mark_all_feed_items_read(request, feed_id: int):
    """피드의 모든 아이템을 읽음 처리"""
    FeedService.mark_all_items_read(request.auth, feed_id)
    return {"success": True}


@feed_router.delete("/{feed_id}/items", auth=JWTAuth())
def delete_all_feed_items(request, feed_id: int):
    """피드의 모든 아이템 삭제"""
    deleted_count = FeedService.delete_all_items(request.auth, feed_id)
    return {"success": True, "deleted_count": deleted_count}


# Feed Source Endpoints (under /feeds/{feed_id}/sources)


@feed_router.post("/{feed_id}/sources", response=SourceSchema, auth=JWTAuth())
def add_source(request, feed_id: int, data: SourceCreateSchema):
    """피드에 새 소스 추가"""
    return SourceService.add_source_to_feed(request.auth, feed_id, data)


@feed_router.put(
    "/{feed_id}/sources/{source_id}", response=SourceSchema, auth=JWTAuth()
)
def update_source(request, feed_id: int, source_id: int, data: SourceUpdateSchema):
    """소스 업데이트"""
    return SourceService.update_feed_source(request.auth, feed_id, source_id, data)


@feed_router.delete("/{feed_id}/sources/{source_id}", auth=JWTAuth())
def delete_source(request, feed_id: int, source_id: int):
    """소스 삭제"""
    SourceService.delete_feed_source(request.auth, feed_id, source_id)
    return {"success": True}


# ============== Item Endpoints ==============


@item_router.put("/{item_id}/favorite")
def toggle_item_favorite(request, item_id: int):
    """아이템 즐겨찾기 토글"""
    return ItemService.toggle_favorite(request.auth, item_id)


@item_router.put("/{item_id}/read")
def toggle_item_read(request, item_id: int):
    """아이템 읽음 상태 토글"""
    return ItemService.toggle_read(request.auth, item_id)


@item_router.get("", response=list[ItemSchema])
@paginate(CursorPagination[RSSItem],ordering_field="published_at")
def list_all_items(
    request,
    is_read: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: str = "",
):
    """메인 화면 아이템 목록"""
    return ItemService.list_all_items(
        request.auth, is_read, is_favorite, search
    )


@item_router.get("/category/{category_id}", response=list[ItemSchema])
@paginate(CursorPagination[RSSItem],ordering_field="published_at")
def list_items_by_category(
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


@item_router.get("/feed/{feed_id}", response=list[ItemSchema])
@paginate(CursorPagination[RSSItem],ordering_field="published_at")
def list_items_by_feed(
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


def generate_rss_xml(items, title: str, link: str, description: str) -> str:
    """RSSItem 목록을 RSS 2.0 XML로 변환"""
    from xml.etree.ElementTree import Element, SubElement, tostring
    from xml.dom import minidom
    from datetime import timezone as tz

    rss = Element("rss", version="2.0")
    rss.set("xmlns:atom", "http://www.w3.org/2005/Atom")
    rss.set("xmlns:content", "http://purl.org/rss/1.0/modules/content/")

    channel = SubElement(rss, "channel")
    SubElement(channel, "title").text = title
    SubElement(channel, "link").text = link
    SubElement(channel, "description").text = description
    SubElement(channel, "language").text = "ko"

    for item in items:
        item_elem = SubElement(channel, "item")
        SubElement(item_elem, "title").text = item.title
        SubElement(item_elem, "link").text = item.link
        SubElement(item_elem, "guid", isPermaLink="false").text = item.guid

        # pubDate in RFC 822 format
        if item.published_at:
            pub_date = item.published_at
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=tz.utc)
            SubElement(item_elem, "pubDate").text = pub_date.strftime("%a, %d %b %Y %H:%M:%S %z")

        if item.description:
            desc_elem = SubElement(item_elem, "description")
            desc_elem.text = item.description

        if item.author:
            SubElement(item_elem, "author").text = item.author

        if item.image:
            enclosure = SubElement(item_elem, "enclosure")
            enclosure.set("url", item.image)
            enclosure.set("type", "image/jpeg")

    xml_str = tostring(rss, encoding="unicode")
    # Pretty print
    dom = minidom.parseString(xml_str)
    return dom.toprettyxml(indent="  ", encoding=None)


def generate_atom_xml(items, title: str, link: str, feed_id: str) -> str:
    """RSSItem 목록을 Atom 1.0 XML로 변환"""
    from xml.etree.ElementTree import Element, SubElement, tostring
    from xml.dom import minidom
    from datetime import timezone as tz

    feed = Element("feed")
    feed.set("xmlns", "http://www.w3.org/2005/Atom")

    SubElement(feed, "title").text = title
    SubElement(feed, "id").text = f"urn:drss:feed:{feed_id}"

    link_elem = SubElement(feed, "link")
    link_elem.set("href", link)
    link_elem.set("rel", "alternate")

    # Updated time (latest item or now)
    from django.utils import timezone
    if items:
        latest = max(items, key=lambda x: x.published_at if x.published_at else timezone.now())
        updated = latest.published_at or timezone.now()
    else:
        updated = timezone.now()
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=tz.utc)
    SubElement(feed, "updated").text = updated.isoformat()

    for item in items:
        entry = SubElement(feed, "entry")
        SubElement(entry, "title").text = item.title
        SubElement(entry, "id").text = item.guid

        entry_link = SubElement(entry, "link")
        entry_link.set("href", item.link)
        entry_link.set("rel", "alternate")

        if item.published_at:
            pub_date = item.published_at
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=tz.utc)
            SubElement(entry, "published").text = pub_date.isoformat()
            SubElement(entry, "updated").text = pub_date.isoformat()

        if item.description:
            content = SubElement(entry, "content")
            content.set("type", "html")
            content.text = item.description

            summary = SubElement(entry, "summary")
            summary.set("type", "html")
            summary.text = item.description[:500] if len(item.description) > 500 else item.description

        if item.author:
            author_elem = SubElement(entry, "author")
            SubElement(author_elem, "name").text = item.author

    xml_str = tostring(feed, encoding="unicode")
    dom = minidom.parseString(xml_str)
    return dom.toprettyxml(indent="  ", encoding=None)


@item_router.get("/rss", auth=None)
def export_all_items_rss(
    request,
    page: int = 1,
    page_size: int = 50,
    format: str = "rss",  # "rss" or "atom"
):
    """공개된 카테고리/피드의 아이템을 RSS/Atom 피드로 내보내기 (인증 불필요)"""
    offset = (page - 1) * page_size

    # is_public=True인 카테고리와 피드만 조회
    items = list(
        RSSItem.objects.filter(
            feed__is_public=True,
            feed__category__is_public=True,
        ).order_by("-published_at")[offset:offset + page_size]
    )

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


@item_router.get("/category/{category_id}/rss", auth=None)
def export_category_items_rss(
    request,
    category_id: int,
    page: int = 1,
    page_size: int = 50,
    format: str = "rss",
):
    """공개된 카테고리의 공개 피드 아이템을 RSS/Atom 피드로 내보내기 (인증 불필요)"""
    from ninja.errors import HttpError

    # 카테고리가 존재하고 is_public=True인지 확인
    category = RSSCategory.objects.filter(id=category_id, is_public=True).first()
    if not category:
        raise HttpError(404, "Category not found or not public")

    offset = (page - 1) * page_size

    # 해당 카테고리의 is_public=True인 피드들의 아이템만 조회
    items = list(
        RSSItem.objects.filter(
            feed__category_id=category_id,
            feed__is_public=True,
        ).order_by("-published_at")[offset:offset + page_size]
    )

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


@item_router.get("/feed/{feed_id}/rss", auth=None)
def export_feed_items_rss(
    request,
    feed_id: int,
    page: int = 1,
    page_size: int = 50,
    format: str = "rss",
):
    """공개된 피드의 아이템을 RSS/Atom 피드로 내보내기 (인증 불필요)"""
    from ninja.errors import HttpError

    # 피드가 존재하고 is_public=True이고, 카테고리도 is_public=True인지 확인
    feed = RSSFeed.objects.filter(
        id=feed_id,
        is_public=True,
        category__is_public=True,
    ).first()
    if not feed:
        raise HttpError(404, "Feed not found or not public")

    offset = (page - 1) * page_size

    items = list(
        RSSItem.objects.filter(feed_id=feed_id)
        .order_by("-published_at")[offset:offset + page_size]
    )

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


# ============== RSS Everything (Source) Endpoints ==============


@source_router.post("/fetch-html", response=FetchHTMLResponse, auth=JWTAuth())
def fetch_html(request, data: FetchHTMLRequest):
    """URL에서 HTML을 가져옴"""
    result = SourceService.fetch_html(
        url=data.url,
        use_browser=data.use_browser,
        wait_selector=data.wait_selector,
        timeout=data.timeout,
        custom_headers=data.custom_headers if data.custom_headers else None,
    )
    return FetchHTMLResponse(**result)


@source_router.post(
    "/extract-elements", response=ExtractElementsResponse, auth=JWTAuth()
)
def extract_elements(request, data: ExtractElementsRequest):
    """HTML에서 CSS 셀렉터로 요소들을 추출"""
    result = SourceService.extract_elements(data.html, data.selector, data.base_url)
    if result["success"]:
        return ExtractElementsResponse(
            success=True,
            elements=[ElementInfo(**el) for el in result["elements"]],
            count=result["count"],
        )
    return ExtractElementsResponse(success=False, error=result.get("error"))


@source_router.post("/preview-items", response=PreviewItemResponse, auth=JWTAuth())
def preview_items(request, data: PreviewItemRequest):
    """설정된 셀렉터로 아이템들을 미리보기"""
    result = SourceService.preview_items(
        url=data.url,
        item_selector=data.item_selector,
        title_selector=data.title_selector,
        link_selector=data.link_selector,
        description_selector=data.description_selector,
        date_selector=data.date_selector,
        image_selector=data.image_selector,
        use_browser=data.use_browser,
        wait_selector=data.wait_selector,
        custom_headers=data.custom_headers if data.custom_headers else None,
        exclude_selectors=data.exclude_selectors,
        follow_links=data.follow_links,
        detail_title_selector=data.detail_title_selector,
        detail_description_selector=data.detail_description_selector,
        detail_content_selector=data.detail_content_selector,
        detail_date_selector=data.detail_date_selector,
        detail_image_selector=data.detail_image_selector,
    )
    if result["success"]:
        return PreviewItemResponse(
            success=True,
            items=[PreviewItem(**item) for item in result["items"]],
            count=result["count"],
        )
    return PreviewItemResponse(success=False, error=result.get("error"))


@source_router.get("", response=list[RSSEverythingSchema], auth=JWTAuth())
def list_sources(request):
    """사용자의 RSSEverything 소스 목록 조회"""
    sources = SourceService.get_user_sources(request.auth)
    return [RSSEverythingSchema.from_orm(s) for s in sources]


@source_router.get("/{source_id}", response=RSSEverythingSchema, auth=JWTAuth())
def get_source(request, source_id: int):
    """RSSEverything 소스 상세 조회"""
    source = SourceService.get_source(request.auth, source_id)
    return RSSEverythingSchema.from_orm(source)


@source_router.post("", response=RSSEverythingSchema, auth=JWTAuth())
def create_source(request, data: RSSEverythingCreateRequest):
    """기존 피드에 새 RSSEverything 소스 추가"""
    source = SourceService.create_source(request.auth, data.feed_id, data.dict())
    return RSSEverythingSchema.from_orm(source)


@source_router.put("/{source_id}", response=RSSEverythingSchema, auth=JWTAuth())
def update_source_rss(request, source_id: int, data: RSSEverythingUpdateRequest):
    """RSSEverything 소스 수정"""
    source = SourceService.update_source(
        request.auth, source_id, data.dict(exclude_unset=True)
    )
    return RSSEverythingSchema.from_orm(source)


@source_router.delete("/{source_id}", auth=JWTAuth())
def delete_source_rss(request, source_id: int):
    """RSSEverything 소스 삭제 - 연결된 RSSFeed도 함께 삭제"""
    SourceService.delete_source(request.auth, source_id)
    return {"success": True}


@source_router.post("/{source_id}/refresh", response=RefreshResponse, auth=JWTAuth())
def refresh_source(request, source_id: int):
    """RSSEverything 소스를 새로고침"""
    result = SourceService.refresh_source(request.auth, source_id)
    return RefreshResponse(**result)


# ============== Task Result Endpoints ==============


@task_result_router.get("", response=list[TaskResultSchema], auth=JWTAuth())
@paginate(CursorPagination[FeedTaskResult], ordering_field="created_at")
def list_task_results(
    request,
    feed_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """Task 결과 목록 조회"""
    return TaskResultService.list_task_results(request.auth, feed_id, status)


@task_result_router.get("/stats", response=TaskStatsSchema, auth=JWTAuth())
def get_task_stats(request, feed_id: Optional[int] = None):
    """Task 통계 조회"""
    return TaskResultService.get_task_stats(request.auth, feed_id)


@task_result_router.get("/{result_id}", response=TaskResultSchema, auth=JWTAuth())
def get_task_result(request, result_id: int):
    """특정 Task 결과 상세 조회"""
    result = TaskResultService.get_task_result(request.auth, result_id)
    return TaskResultSchema.from_orm(result)


@task_result_router.delete("/{result_id}", auth=JWTAuth())
def delete_task_result(request, result_id: int):
    """특정 Task 결과 삭제"""
    TaskResultService.delete_task_result(request.auth, result_id)
    return {"success": True}


@task_result_router.delete("", auth=JWTAuth())
def clear_task_results(
    request,
    feed_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """Task 결과 일괄 삭제"""
    deleted_count = TaskResultService.clear_task_results(request.auth, feed_id, status)
    return {"success": True, "deleted": deleted_count}


# ============== Periodic Task Endpoints ==============


@periodic_task_router.get("", response=PeriodicTaskListResponse, auth=JWTAuth())
def list_periodic_tasks(
    request,
    feed_id: Optional[int] = None,
    enabled: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
):
    """주기적 태스크 목록 조회"""
    result = PeriodicTaskService.list_periodic_tasks(
        request.auth, feed_id, enabled, limit, offset
    )
    return PeriodicTaskListResponse(
        items=[
            PeriodicTaskSchema.from_orm(task, feed_id, feed_title)
            for task, feed_id, feed_title in result["items"]
        ],
        total=result["total"],
    )


@periodic_task_router.get("/stats", auth=JWTAuth())
def get_periodic_task_stats(request):
    """주기적 태스크 통계 조회"""
    return PeriodicTaskService.get_task_stats(request.auth)


@periodic_task_router.get("/{task_id}", response=PeriodicTaskSchema, auth=JWTAuth())
def get_periodic_task(request, task_id: int):
    """특정 주기적 태스크 상세 조회"""
    task, feed_id, feed_title = PeriodicTaskService.get_periodic_task(
        request.auth, task_id
    )
    return PeriodicTaskSchema.from_orm(task, feed_id, feed_title)


@periodic_task_router.put("/{task_id}", response=PeriodicTaskSchema, auth=JWTAuth())
def update_periodic_task(request, task_id: int, data: PeriodicTaskUpdateSchema):
    """주기적 태스크 업데이트"""
    task, feed_id, feed_title = PeriodicTaskService.update_periodic_task(
        request.auth, task_id, data.enabled, data.interval_minutes
    )
    return PeriodicTaskSchema.from_orm(task, feed_id, feed_title)


@periodic_task_router.post(
    "/{task_id}/toggle", response=PeriodicTaskSchema, auth=JWTAuth()
)
def toggle_periodic_task(request, task_id: int):
    """주기적 태스크 활성화/비활성화 토글"""
    task, feed_id, feed_title = PeriodicTaskService.toggle_periodic_task(
        request.auth, task_id
    )
    return PeriodicTaskSchema.from_orm(task, feed_id, feed_title)


@periodic_task_router.delete("/{task_id}", auth=JWTAuth())
def delete_periodic_task(request, task_id: int):
    """주기적 태스크 삭제"""
    PeriodicTaskService.delete_periodic_task(request.auth, task_id)
    return {"success": True}
