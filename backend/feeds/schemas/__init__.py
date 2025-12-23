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
    FetchHTMLRequest,
    FetchHTMLResponse,
    ElementInfo,
    ExtractElementsRequest,
    ExtractElementsResponse,
    PreviewItem,
    CrawlRequest,
    PreviewItemResponse,
    SourceSchema,
    SourceCreateSchema,
    SourceUpdateSchema,
    RefreshResponse,
    PaginationCrawlRequest,
    PaginationCrawlResponse,
)
from .item import (
    ItemSchema,
    ItemFilterSchema,
    PaginatedResponse,
    ItemRefreshResponse,
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
    "FetchHTMLRequest",
    "FetchHTMLResponse",
    "ElementInfo",
    "ExtractElementsRequest",
    "ExtractElementsResponse",
    "PreviewItem",
    "CrawlRequest",
    "PreviewItemResponse",
    "RSSEverythingSchema",
    "RSSEverythingCreateRequest",
    "RSSEverythingUpdateRequest",
    "RefreshResponse",
    # Item
    "ItemSchema",
    "ItemFilterSchema",
    "PaginatedResponse",
    "ItemRefreshResponse",
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
