"""
Task Result Schemas - 태스크 결과 관련 스키마
"""

from typing import Optional
from pydantic import BaseModel


class FeedInfo(BaseModel):
    """피드 기본 정보"""

    id: int
    title: str


class TaskResultSchema(BaseModel):
    """태스크 결과 스키마"""

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
    def from_orm(obj) -> "TaskResultSchema":
        return TaskResultSchema(
            id=obj.id,
            feed=FeedInfo(id=obj.feed.id, title=obj.feed.title),
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
    """태스크 결과 목록 응답"""

    items: list[TaskResultSchema]
    total: int


class TaskStatsSchema(BaseModel):
    """태스크 통계"""

    total: int
    success: int
    failure: int
    pending: int
    running: int
