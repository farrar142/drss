"""
Task 결과 조회 API
피드 수집 작업의 성공/실패 내역을 조회합니다.
"""

from typing import Optional
from ninja import Router
from ninja.pagination import paginate, LimitOffsetPagination
from pydantic import BaseModel
from base.authentications import JWTAuth
from feeds.models import FeedTaskResult, RSSFeed

router = Router(tags=["task-results"])


class FeedInfo(BaseModel):
    """피드 기본 정보"""

    id: int
    title: str


class TaskResultSchema(BaseModel):
    """Task 결과 스키마"""

    id: int
    feed: FeedInfo
    task_id: str
    status: str
    items_found: int
    items_created: int
    error_message: str
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: str
    duration_seconds: Optional[float]

    @staticmethod
    def from_orm(obj: FeedTaskResult) -> "TaskResultSchema":
        return TaskResultSchema(
            id=obj.id,
            feed=FeedInfo(
                id=obj.feed.id,
                title=obj.feed.title,
            ),
            task_id=obj.task_id,
            status=obj.status,
            items_found=obj.items_found,
            items_created=obj.items_created,
            error_message=obj.error_message,
            started_at=obj.started_at.isoformat() if obj.started_at else None,
            completed_at=obj.completed_at.isoformat() if obj.completed_at else None,
            created_at=obj.created_at.isoformat(),
            duration_seconds=obj.duration_seconds,
        )


class TaskResultListResponse(BaseModel):
    """Task 결과 목록 응답"""

    items: list[TaskResultSchema]
    total: int


class TaskStatsSchema(BaseModel):
    """Task 통계"""

    total: int
    success: int
    failure: int
    pending: int
    running: int


@router.get("", response=TaskResultListResponse, auth=JWTAuth())
def list_task_results(
    request,
    feed_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    """
    Task 결과 목록 조회

    Parameters:
    - feed_id: 특정 피드의 결과만 조회
    - status: 상태 필터 (pending, running, success, failure)
    - limit: 페이지당 항목 수 (기본 20)
    - offset: 오프셋
    """
    # 사용자의 피드에 대한 결과만 조회
    user_feeds = RSSFeed.objects.filter(user=request.auth).values_list("id", flat=True)
    queryset = FeedTaskResult.objects.filter(feed_id__in=user_feeds)

    if feed_id:
        queryset = queryset.filter(feed_id=feed_id)

    if status:
        queryset = queryset.filter(status=status)

    total = queryset.count()
    results = queryset.order_by("-created_at")[offset : offset + limit]

    return TaskResultListResponse(
        items=[TaskResultSchema.from_orm(r) for r in results],
        total=total,
    )


@router.get("/stats", response=TaskStatsSchema, auth=JWTAuth())
def get_task_stats(request, feed_id: Optional[int] = None):
    """
    Task 통계 조회

    Parameters:
    - feed_id: 특정 피드의 통계만 조회
    """
    user_feeds = RSSFeed.objects.filter(user=request.auth).values_list("id", flat=True)
    queryset = FeedTaskResult.objects.filter(feed_id__in=user_feeds)

    if feed_id:
        queryset = queryset.filter(feed_id=feed_id)

    return TaskStatsSchema(
        total=queryset.count(),
        success=queryset.filter(status=FeedTaskResult.Status.SUCCESS).count(),
        failure=queryset.filter(status=FeedTaskResult.Status.FAILURE).count(),
        pending=queryset.filter(status=FeedTaskResult.Status.PENDING).count(),
        running=queryset.filter(status=FeedTaskResult.Status.RUNNING).count(),
    )


@router.get("/{result_id}", response=TaskResultSchema, auth=JWTAuth())
def get_task_result(request, result_id: int):
    """
    특정 Task 결과 상세 조회
    """
    from django.shortcuts import get_object_or_404

    result = get_object_or_404(
        FeedTaskResult,
        id=result_id,
        feed__user=request.auth,
    )
    return TaskResultSchema.from_orm(result)


@router.delete("/{result_id}", auth=JWTAuth())
def delete_task_result(request, result_id: int):
    """
    특정 Task 결과 삭제
    """
    from django.shortcuts import get_object_or_404

    result = get_object_or_404(
        FeedTaskResult,
        id=result_id,
        feed__user=request.auth,
    )
    result.delete()
    return {"success": True}


@router.delete("", auth=JWTAuth())
def clear_task_results(
    request,
    feed_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """
    Task 결과 일괄 삭제

    Parameters:
    - feed_id: 특정 피드의 결과만 삭제
    - status: 특정 상태의 결과만 삭제
    """
    user_feeds = RSSFeed.objects.filter(user=request.auth).values_list("id", flat=True)
    queryset = FeedTaskResult.objects.filter(feed_id__in=user_feeds)

    if feed_id:
        queryset = queryset.filter(feed_id=feed_id)

    if status:
        queryset = queryset.filter(status=status)

    deleted_count = queryset.count()
    queryset.delete()

    return {"success": True, "deleted": deleted_count}
