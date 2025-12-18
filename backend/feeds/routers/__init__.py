"""
Feeds Routers Package

도메인별로 분리된 API 라우터들을 export합니다.
"""

from .category import router as category_router
from .feed import router as feed_router
from .item import router as item_router
from .rss_everything import router as rss_everything_router
from .task_results import router as task_results_router
from .periodic_task import router as periodic_task_router

__all__ = [
    "category_router",
    "feed_router",
    "item_router",
    "rss_everything_router",
    "task_results_router",
    "periodic_task_router",
]
