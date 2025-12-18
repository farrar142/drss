"""
Periodic Task Router - 주기적 태스크 관련 API 엔드포인트
"""

from typing import Optional

from ninja import Router

from base.authentications import JWTAuth
from feeds.services import PeriodicTaskService
from feeds.schemas import (
    PeriodicTaskSchema,
    PeriodicTaskListResponse,
    PeriodicTaskUpdateSchema,
)

router = Router(tags=["periodic-tasks"])


@router.get("", response=PeriodicTaskListResponse, auth=JWTAuth(), operation_id="listPeriodicTasks")
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


@router.get("/stats", auth=JWTAuth(), operation_id="getPeriodicTaskStats")
def get_periodic_task_stats(request):
    """주기적 태스크 통계 조회"""
    return PeriodicTaskService.get_task_stats(request.auth)


@router.get("/{task_id}", response=PeriodicTaskSchema, auth=JWTAuth(), operation_id="getPeriodicTask")
def get_periodic_task(request, task_id: int):
    """특정 주기적 태스크 상세 조회"""
    task, feed_id, feed_title = PeriodicTaskService.get_periodic_task(
        request.auth, task_id
    )
    return PeriodicTaskSchema.from_orm(task, feed_id, feed_title)


@router.put("/{task_id}", response=PeriodicTaskSchema, auth=JWTAuth(), operation_id="updatePeriodicTask")
def update_periodic_task(request, task_id: int, data: PeriodicTaskUpdateSchema):
    """주기적 태스크 업데이트"""
    task, feed_id, feed_title = PeriodicTaskService.update_periodic_task(
        request.auth, task_id, data.enabled, data.interval_minutes
    )
    return PeriodicTaskSchema.from_orm(task, feed_id, feed_title)


@router.post("/{task_id}/toggle", response=PeriodicTaskSchema, auth=JWTAuth(), operation_id="togglePeriodicTask")
def toggle_periodic_task(request, task_id: int):
    """주기적 태스크 활성화/비활성화 토글"""
    task, feed_id, feed_title = PeriodicTaskService.toggle_periodic_task(
        request.auth, task_id
    )
    return PeriodicTaskSchema.from_orm(task, feed_id, feed_title)


@router.delete("/{task_id}", auth=JWTAuth(), operation_id="deletePeriodicTask")
def delete_periodic_task(request, task_id: int):
    """주기적 태스크 삭제"""
    PeriodicTaskService.delete_periodic_task(request.auth, task_id)
    return {"success": True}
