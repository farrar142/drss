"""
Task Result Router - 태스크 결과 관련 API 엔드포인트
"""

from typing import Optional

from ninja import Router
from ninja.pagination import paginate

from base.authentications import JWTAuth
from base.paginations import CursorPagination
from feeds.models import FeedTaskResult
from feeds.services import TaskResultService
from feeds.schemas import TaskResultSchema, TaskStatsSchema

router = Router(tags=["task-results"])


@router.get("", response=list[TaskResultSchema], auth=JWTAuth(), operation_id="listTaskResults")
@paginate(CursorPagination[FeedTaskResult], ordering_field="created_at")
def list_task_results(
    request,
    feed_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """Task 결과 목록 조회"""
    return TaskResultService.list_task_results(request.auth, feed_id, status)


@router.get("/stats", response=TaskStatsSchema, auth=JWTAuth(), operation_id="getTaskStats")
def get_task_stats(request, feed_id: Optional[int] = None):
    """Task 통계 조회"""
    return TaskResultService.get_task_stats(request.auth, feed_id)


@router.get("/{result_id}", response=TaskResultSchema, auth=JWTAuth(), operation_id="getTaskResult")
def get_task_result(request, result_id: int):
    """특정 Task 결과 상세 조회"""
    result = TaskResultService.get_task_result(request.auth, result_id)
    return TaskResultSchema.from_orm(result)


@router.delete("/{result_id}", auth=JWTAuth(), operation_id="deleteTaskResult")
def delete_task_result(request, result_id: int):
    """특정 Task 결과 삭제"""
    TaskResultService.delete_task_result(request.auth, result_id)
    return {"success": True}


@router.delete("", auth=JWTAuth(), operation_id="clearTaskResults")
def clear_task_results(
    request,
    feed_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """Task 결과 일괄 삭제"""
    deleted_count = TaskResultService.clear_task_results(request.auth, feed_id, status)
    return {"success": True, "deleted": deleted_count}
