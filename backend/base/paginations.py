from typing import TypeVar, Optional, Any, List
from django.db.models import Model, QuerySet
from django.http import HttpRequest
from ninja import Schema
from ninja.pagination import PaginationBase


class CursorPagination[T:Model](PaginationBase):
    """
    Django Ninja를 위한 양방향 커서 기반 페이지네이션 구현 클래스.
    'before' (이전/구형 데이터) 및 'after' (다음/신규 데이터) 탐색을 지원합니다.
    """

    class Input(Schema):
        # 커서 값: 다음 페이지를 가져올 기준점
        cursor: Optional[str] = None
        # 가져올 아이템 개수
        limit: int = 10
        # 데이터 탐색 방향: "after" (이후 데이터) 또는 "before" (이전 데이터)
        direction: str = "after"
        # 정렬 기준으로 사용할 모델 필드 이름 (기본값: "id")
        ordering_field: str = "id"

    class Output(Schema):
        items: List[Any]
        # 다음 페이지를 위한 커서
        next_cursor: Optional[str] = None
        # 이전 페이지를 위한 커서
        prev_cursor: Optional[str] = None
        # 다음 페이지가 있는지 여부
        has_next: bool = False
        # 이전 페이지가 있는지 여부
        has_prev: bool = False

    def _get_cursor_value(self, item: T, field_name: str) -> Optional[str]:
        """
        아이템에서 커서 필드 값을 추출하고 문자열로 변환합니다.
        """
        try:
            cursor_field = getattr(item, field_name)
        except AttributeError:
            return None

        if isinstance(cursor_field, str):
            return cursor_field
        elif hasattr(cursor_field, "isoformat"):
            # datetime 객체 처리
            return cursor_field.isoformat().replace("+00:00", "Z")
        else:
            # 기타 타입 (int, uuid 등) 처리
            return str(cursor_field)

    def paginate_queryset(self, queryset: QuerySet[T], pagination: Input, request: HttpRequest, **params: Any) -> Any:
        cursor = pagination.cursor
        direction = pagination.direction.lower()
        field_name = pagination.ordering_field
        limit = pagination.limit

        # 1. 초기 정렬 설정 및 커서 필터링
        if cursor and cursor != "None":
            if direction == "before":
                # 이전 데이터 (커서보다 작은 값) 요청 시:
                # 데이터를 오름차순으로 가져온 후, 순서를 뒤집어 클라이언트에게 최신순으로 전달
                queryset = queryset.filter(**{f"{field_name}__lt": cursor})
                # 오름차순 정렬 (예: 1, 2, 3... 순)
                queryset = queryset.order_by(field_name)

            elif direction == "after":
                # 다음 데이터 (커서보다 큰 값) 요청 시:
                # 데이터를 오름차순으로 가져와 최신순으로 전달 (커서 이후 항목)
                queryset = queryset.filter(**{f"{field_name}__gt": cursor})
                # 오름차순 정렬 (예: 11, 12, 13... 순)
                queryset = queryset.order_by(field_name)
            else:
                # direction이 잘못된 경우, 기본 정렬을 따릅니다.
                 queryset = queryset.order_by(f"-{field_name}")
        else:
            # 최초 요청 (커서 없음) 시: 최신 항목부터 보여주기 위해 내림차순 정렬
            queryset = queryset.order_by(f"-{field_name}")

        # 2. 항목 가져오기 (limit + 1)
        paginated_items = list(queryset[: limit + 1])

        # 3. before 요청 시 순서 뒤집기 (클라이언트에게 올바른 순서로 보여주기 위해)
        if cursor and direction == "before":
            # 오름차순으로 가져온 항목을 뒤집어 내림차순으로 만듭니다.
            paginated_items.reverse()

        # 4. 페이지네이션 상태 계산
        # limit+1개의 항목 중 limit개를 제외한 나머지로 다음/이전 페이지 여부 판단

        # 최초 요청이나 'after' 요청 시:
        if not cursor or direction == "after":
            items_list = paginated_items[:limit]
            has_next = len(paginated_items) > limit
            has_prev = bool(cursor) # 커서가 존재했다면 이전 페이지도 존재할 수 있다고 가정

            # 'next' 커서는 리스트의 마지막 항목을 기준으로 설정
            next_cursor = self._get_cursor_value(items_list[-1], field_name) if has_next and items_list else None
            # 'prev' 커서는 리스트의 첫 번째 항목을 기준으로 설정
            prev_cursor = self._get_cursor_value(items_list[0], field_name) if has_prev and items_list else None

        # 'before' 요청 시:
        elif direction == "before":
            items_list = paginated_items[:limit]
            has_prev = len(paginated_items) > limit # limit+1개 중 마지막 1개는 이전 페이지가 있다는 의미
            has_next = True # 'before'로 왔다는 것은 일반적으로 'after'로 돌아갈 수 있다는 의미 (다만 정확한 체크는 복잡함, 여기서는 단순화)

            # 'next' 커서는 리스트의 마지막 항목을 기준으로 설정
            next_cursor = self._get_cursor_value(items_list[-1], field_name) if items_list else None
            # 'prev' 커서는 리스트의 첫 번째 항목을 기준으로 설정
            prev_cursor = self._get_cursor_value(items_list[0], field_name) if has_prev and items_list else None


        return {
            "items": items_list,
            "next_cursor": next_cursor,
            "prev_cursor": prev_cursor,
            "has_next": has_next,
            "has_prev": has_prev,
        }
