"""
Source Router - RSS Everything 소스 관련 API 엔드포인트
"""

from ninja import Router

from base.authentications import JWTAuth
from feeds.services import SourceService
from feeds.schemas import (
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
    PaginationCrawlRequest,
    PaginationCrawlResponse,
)

router = Router(tags=["rss-everything"])


@router.post("/fetch-html", response=FetchHTMLResponse, auth=JWTAuth(), operation_id="fetchHtml")
def fetch_html(request, data: FetchHTMLRequest):
    """사용자가 선택한 브라우저 서비스로 URL에서 HTML을 가져옴"""
    result = SourceService.fetch_html(
        url=data.url,
        use_browser=data.use_browser,
        browser_service=data.browser_service,
        wait_selector=data.wait_selector,
        timeout=data.timeout,
        custom_headers=data.custom_headers if data.custom_headers else None,
    )
    return result


@router.post("/extract-elements", response=ExtractElementsResponse, auth=JWTAuth(), operation_id="extractElements")
def extract_elements(request, data: ExtractElementsRequest):
    """HTML에서 CSS 셀렉터로 요소들을 추출"""
    result = SourceService.extract_elements(data.html, data.selector, data.base_url)
    if result.success:
        return ExtractElementsResponse(
            success=True,
            elements=[ElementInfo(**el.dict()) for el in result.elements],
            count=result.count,
        )
    return ExtractElementsResponse(success=False, error=result.error)


@router.post("/preview-items", response=PreviewItemResponse, auth=JWTAuth(), operation_id="previewItems")
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
        browser_service=data.browser_service,
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
    if result.success:
        return PreviewItemResponse(
            success=True,
            items=[PreviewItem(**item.dict()) for item in result.items],
            count=result.count,
        )
    return PreviewItemResponse(success=False, error=result.error)


@router.get("", response=list[RSSEverythingSchema], auth=JWTAuth(), operation_id="listRssEverythingSources")
def list_sources(request):
    """사용자의 RSSEverything 소스 목록 조회"""
    sources = SourceService.get_user_sources(request.auth)
    return [RSSEverythingSchema.from_orm(s) for s in sources]


@router.post("/crawl-paginated", response=PaginationCrawlResponse, auth=JWTAuth(), operation_id="crawlPaginated")
def crawl_paginated(request, data: PaginationCrawlRequest):
    """
    페이지네이션을 사용하여 여러 페이지를 순회하며 크롤링

    URL 템플릿에 {변수명} 형태로 변수를 지정합니다.

    예시:
    - url_template: "https://example.com/posts?page={page}"
    - variables: [{"name": "page", "start": 1, "end": 10, "step": 1}]

    여러 변수도 가능 (Cartesian product):
    - url_template: "https://example.com?page={page}&category={cat}"
    - variables: [
        {"name": "page", "start": 1, "end": 5},
        {"name": "cat", "start": 1, "end": 3}
      ]
    """
    result = SourceService.crawl_with_pagination(
        user=request.auth,
        source_id=data.source_id,
        url_template=data.url_template,
        variables=data.variables,
        delay_ms=data.delay_ms,
    )
    return PaginationCrawlResponse(**result)


@router.get("/{source_id}", response=RSSEverythingSchema, auth=JWTAuth(), operation_id="getRssEverythingSource")
def get_source(request, source_id: int):
    """RSSEverything 소스 상세 조회"""
    source = SourceService.get_source(request.auth, source_id)
    return RSSEverythingSchema.from_orm(source)


@router.post("", response=RSSEverythingSchema, auth=JWTAuth(), operation_id="createRssEverythingSource")
def create_source(request, data: RSSEverythingCreateRequest):
    """기존 피드에 새 RSSEverything 소스 추가"""
    source = SourceService.create_source(request.auth, data.feed_id, data.dict())
    return RSSEverythingSchema.from_orm(source)


@router.put("/{source_id}", response=RSSEverythingSchema, auth=JWTAuth(), operation_id="updateRssEverythingSource")
def update_source_rss(request, source_id: int, data: RSSEverythingUpdateRequest):
    """RSSEverything 소스 수정"""
    source = SourceService.update_source(
        request.auth, source_id, data.dict(exclude_unset=True)
    )
    return RSSEverythingSchema.from_orm(source)


@router.delete("/{source_id}", auth=JWTAuth(), operation_id="deleteRssEverythingSource")
def delete_source_rss(request, source_id: int):
    """RSSEverything 소스 삭제 - 연결된 RSSFeed도 함께 삭제"""
    SourceService.delete_source(request.auth, source_id)
    return {"success": True}


@router.post("/{source_id}/refresh", response=RefreshResponse, auth=JWTAuth(), operation_id="refreshRssEverythingSource")
def refresh_source(request, source_id: int):
    """RSSEverything 소스를 새로고침"""
    result = SourceService.refresh_source(request.auth, source_id)
    return RefreshResponse(**result)
