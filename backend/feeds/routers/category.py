"""
Category Router - 카테고리 관련 API 엔드포인트
"""

from ninja import Router

from base.authentications import JWTAuth
from feeds.services import CategoryService
from feeds.schemas import (
    CategorySchema,
    CategoryWithFeedsSchema,
    CategoryCreateSchema,
    CategoryUpdateSchema,
    CategoryReorderSchema,
)

router = Router(tags=["categories"])


@router.get(
    "/with-feeds",
    response=list[CategoryWithFeedsSchema],
    auth=JWTAuth(),
    operation_id="listCategoriesWithFeeds",
)
def list_categories_with_feeds(request):
    """카테고리 목록 + 피드 목록 조회 (초기 로딩 최적화)"""
    return CategoryService.get_user_categories_with_feeds(request.auth)


@router.get(
    "", response=list[CategorySchema], auth=JWTAuth(), operation_id="listCategories"
)
def list_categories(request):
    """카테고리 목록 조회"""
    return CategoryService.get_user_categories(request.auth)


@router.post("", response=CategorySchema, auth=JWTAuth(), operation_id="createCategory")
def create_category(request, data: CategoryCreateSchema):
    """카테고리 생성"""
    return CategoryService.create_category(request.auth, data)


@router.put(
    "/{category_id}",
    response=CategorySchema,
    auth=JWTAuth(),
    operation_id="updateCategory",
)
def update_category(request, category_id: int, data: CategoryUpdateSchema):
    """카테고리 수정"""
    return CategoryService.update_category(request.auth, category_id, data)


@router.post(
    "/reorder",
    response=list[CategorySchema],
    auth=JWTAuth(),
    operation_id="reorderCategories",
)
def reorder_categories(request, data: CategoryReorderSchema):
    """카테고리 순서 일괄 변경"""
    return CategoryService.reorder_categories(request.auth, data)


@router.delete("/{category_id}", auth=JWTAuth(), operation_id="deleteCategory")
def delete_category(request, category_id: int):
    """카테고리 삭제"""
    CategoryService.delete_category(request.auth, category_id)
    return {"success": True}


@router.post(
    "/{category_id}/refresh", auth=JWTAuth(), operation_id="refreshCategoryFeeds"
)
def refresh_category_feeds(request, category_id: int):
    """카테고리의 모든 피드 새로고침"""
    CategoryService.refresh_category_feeds(request.auth, category_id)
    return {"success": True, "message": "Category feeds refresh scheduled"}


@router.get("/{category_id}/stats", auth=JWTAuth(), operation_id="getCategoryStats")
def get_category_stats(request, category_id: int):
    """카테고리 통계 조회"""
    return CategoryService.get_category_stats(request.auth, category_id)
