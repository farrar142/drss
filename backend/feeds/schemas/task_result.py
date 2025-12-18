"""
Task Result Schemas - 태스크 결과 관련 스키마
"""

from datetime import datetime
from typing import Optional
# from pydantic import BaseModel
from ninja import Schema as BaseModel


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
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    duration_seconds: Optional[float]


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
