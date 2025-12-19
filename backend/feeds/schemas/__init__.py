"""
Feeds Schemas - 스키마 모듈
"""

from .category import (
    CategorySchema,
    CategoryWithFeedsSchema,
    CategoryCreateSchema,
    CategoryUpdateSchema,
    CategoryReorderSchema,
)
from .feed import (
    FeedSchema,
    FeedCreateSchema,
    FeedUpdateSchema,
    FeedValidationRequest,
    FeedValidationResponse,
)
from .source import (
    SourceType,
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
)
from .item import (
    ItemSchema,
    ItemFilterSchema,
    PaginatedResponse,
)
from .task_result import (
    FeedInfo,
    TaskResultSchema,
    TaskResultListResponse,
    TaskStatsSchema,
)
from .periodic_task import (
    IntervalScheduleSchema,
    PeriodicTaskSchema,
    PeriodicTaskListResponse,
    PeriodicTaskUpdateSchema,
)

__all__ = [
    # Category
    "CategorySchema",
    "CategoryWithFeedsSchema",
    "CategoryCreateSchema",
    "CategoryUpdateSchema",
    "CategoryReorderSchema",
    # Feed
    "FeedSchema",
    "FeedCreateSchema",
    "FeedUpdateSchema",
    "FeedValidationRequest",
    "FeedValidationResponse",
    # Source
    "SourceType",
    "SourceSchema",
    "SourceCreateSchema",
    "SourceUpdateSchema",
    "FetchHTMLRequest",
    "FetchHTMLResponse",
    "ElementInfo",
    "ExtractElementsRequest",
    "ExtractElementsResponse",
    "PreviewItem",
    "PreviewItemRequest",
    "PreviewItemResponse",
    "RSSEverythingSchema",
    "RSSEverythingCreateRequest",
    "RSSEverythingUpdateRequest",
    "RefreshResponse",
    # Item
    "ItemSchema",
    "ItemFilterSchema",
    "PaginatedResponse",
    # Task Result
    "FeedInfo",
    "TaskResultSchema",
    "TaskResultListResponse",
    "TaskStatsSchema",
    # Periodic Task
    "IntervalScheduleSchema",
    "PeriodicTaskSchema",
    "PeriodicTaskListResponse",
    "PeriodicTaskUpdateSchema",
]
