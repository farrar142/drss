"""
Feed Router - 피드 관련 API 엔드포인트
"""

from ninja import Router
from ninja.errors import HttpError

from base.authentications import JWTAuth
from feeds.services import FeedService, SourceService
from feeds.schemas import (
    FeedSchema,
    FeedCreateSchema,
    FeedUpdateSchema,
    FeedValidationRequest,
    FeedValidationResponse,
    SourceSchema,
    SourceCreateSchema,
    SourceUpdateSchema,
)

router = Router(tags=["feeds"])


@router.post("/validate", response=FeedValidationResponse, auth=JWTAuth(), operation_id="validateFeed")
def validate_feed(request, data: FeedValidationRequest):
    """RSS 피드 URL 검증"""
    try:
        return FeedService.validate_feed(data)
    except Exception as e:
        raise HttpError(400, f"Failed to validate feed: {str(e)}")


@router.get("", response=list[FeedSchema], auth=JWTAuth(), operation_id="listFeeds")
def list_feeds(request):
    """피드 목록 조회"""
    return FeedService.get_user_feeds(request.auth)


@router.post("", response=FeedSchema, auth=JWTAuth(), operation_id="createFeed")
def create_feed(request, data: FeedCreateSchema):
    """피드 생성"""
    return FeedService.create_feed(request.auth, data)


@router.put("/{feed_id}", response=FeedSchema, auth=JWTAuth(), operation_id="updateFeed")
def update_feed(request, feed_id: int, data: FeedUpdateSchema):
    """피드 수정"""
    return FeedService.update_feed(request.auth, feed_id, data)


@router.delete("/{feed_id}", auth=JWTAuth(), operation_id="deleteFeed")
def delete_feed(request, feed_id: int):
    """피드 삭제"""
    FeedService.delete_feed(request.auth, feed_id)
    return {"success": True}


@router.post("/{feed_id}/refresh", auth=JWTAuth(), operation_id="refreshFeed")
def refresh_feed(request, feed_id: int):
    """피드 새로고침"""
    return FeedService.refresh_feed(request.auth, feed_id)


@router.put("/{feed_id}/mark-all-read", auth=JWTAuth(), operation_id="markAllFeedItemsRead")
def mark_all_feed_items_read(request, feed_id: int):
    """피드의 모든 아이템을 읽음 처리"""
    FeedService.mark_all_items_read(request.auth, feed_id)
    return {"success": True}


@router.delete("/{feed_id}/items", auth=JWTAuth(), operation_id="deleteAllFeedItems")
def delete_all_feed_items(request, feed_id: int):
    """피드의 모든 아이템 삭제"""
    deleted_count = FeedService.delete_all_items(request.auth, feed_id)
    return {"success": True, "deleted_count": deleted_count}


# Feed Source Endpoints (under /feeds/{feed_id}/sources)


@router.post("/{feed_id}/sources", response=SourceSchema, auth=JWTAuth(), operation_id="addFeedSource")
def add_source(request, feed_id: int, data: SourceCreateSchema):
    """피드에 새 소스 추가"""
    return SourceService.add_source_to_feed(request.auth, feed_id, data)


@router.put("/{feed_id}/sources/{source_id}", response=SourceSchema, auth=JWTAuth(), operation_id="updateFeedSource")
def update_source(request, feed_id: int, source_id: int, data: SourceUpdateSchema):
    """소스 업데이트"""
    return SourceService.update_feed_source(request.auth, feed_id, source_id, data)


@router.delete("/{feed_id}/sources/{source_id}", auth=JWTAuth(), operation_id="deleteFeedSource")
def delete_source(request, feed_id: int, source_id: int):
    """소스 삭제"""
    SourceService.delete_feed_source(request.auth, feed_id, source_id)
    return {"success": True}
