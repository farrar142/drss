"""
Periodic Task Schemas - 주기적 태스크 관련 스키마
"""

from typing import Optional
from pydantic import BaseModel


class IntervalScheduleSchema(BaseModel):
    """인터벌 스케줄 스키마"""

    every: int
    period: str  # 'minutes', 'hours', 'days' 등


class PeriodicTaskSchema(BaseModel):
    """주기적 태스크 스키마"""

    id: int
    name: str
    task: str
    feed_id: Optional[int]
    feed_title: Optional[str]
    enabled: bool
    interval: Optional[IntervalScheduleSchema]
    last_run_at: Optional[str]
    total_run_count: int
    date_changed: Optional[str]

    @staticmethod
    def from_orm(
        obj, feed_id: Optional[int] = None, feed_title: Optional[str] = None
    ) -> "PeriodicTaskSchema":
        interval = None
        if obj.interval:
            interval = IntervalScheduleSchema(
                every=obj.interval.every,
                period=obj.interval.period,
            )

        return PeriodicTaskSchema(
            id=obj.id,
            name=obj.name,
            task=obj.task,
            feed_id=feed_id,
            feed_title=feed_title,
            enabled=obj.enabled,
            interval=interval,
            last_run_at=obj.last_run_at.isoformat() if obj.last_run_at else None,
            total_run_count=obj.total_run_count,
            date_changed=obj.date_changed.isoformat() if obj.date_changed else None,
        )


class PeriodicTaskListResponse(BaseModel):
    """주기적 태스크 목록 응답"""

    items: list[PeriodicTaskSchema]
    total: int


class PeriodicTaskUpdateSchema(BaseModel):
    """주기적 태스크 업데이트 스키마"""

    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = None
