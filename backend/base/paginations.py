from typing import TypeVar, Optional, Any, List
from django.db.models import Model, QuerySet
from django.http import HttpRequest
from ninja import Schema
from ninja.pagination import PaginationBase
from datetime import datetime


class CursorPagination[T:Model](PaginationBase):
    """
    Django Ninja를 위한 양방향 커서 기반 페이지네이션 구현 클래스.
    'before' (이전/구형 데이터) 및 'after' (다음/신규 데이터) 탐색을 지원합니다.
    """

    # 클래스 레벨 기본 ordering_field
    ordering_field = "id"

    class Input(Schema):
        # 커서 값: 다음 페이지를 가져올 기준점
        cursor: Optional[str] = None
        # 가져올 아이템 개수
        limit: int = 10
        # 데이터 탐색 방향: "after" (이후 데이터) 또는 "before" (이전 데이터)
        direction: str = "after"
        # 정렬 기준으로 사용할 모델 필드 이름 (클라이언트가 전달하지 않으면 클래스의 default_ordering_field 사용)
        ordering_field: Optional[str] = None

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

    def __init__(self, ordering_field: Optional[str] = None,**kwargs):
        super().__init__(**kwargs)
        if ordering_field:
            self.ordering_field = ordering_field

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

    def _parse_cursor_value(self, cursor: str, queryset: QuerySet[T], field_name: str) -> Any:
        """
        문자열 커서 값을 필드의 원래 타입으로 변환합니다.
        """
        # QuerySet의 모델 클래스 가져오기
        model = queryset.model

        # 필드의 타입 확인
        field = model._meta.get_field(field_name)
        field_type = field.__class__.__name__

        try:
            # IntegerField, BigIntegerField, SmallIntegerField 등 정수형 필드
            if 'IntegerField' in field_type or field_type in ['AutoField', 'BigAutoField']:
                return int(cursor)
            # DateTimeField
            elif field_type == 'DateTimeField':
                # ISO 형식의 날짜 문자열 파싱
                if cursor.endswith('Z'):
                    cursor = cursor[:-1] + '+00:00'
                return datetime.fromisoformat(cursor)
            # DateField
            elif field_type == 'DateField':
                return datetime.fromisoformat(cursor).date()
            # FloatField
            elif field_type == 'FloatField':
                return float(cursor)
            # 기타 (CharField, TextField, UUIDField 등)
            else:
                return cursor
        except (ValueError, TypeError):
            # 변환 실패 시 원본 반환
            return cursor

    def paginate_queryset(self, queryset: QuerySet[T], pagination: Input, request: HttpRequest, **params: Any) -> Any:
        cursor = pagination.cursor
        direction = pagination.direction.lower()
        field_name = pagination.ordering_field
        limit = pagination.limit

        if not field_name:
            field_name = self.ordering_field

        # 1. 초기 정렬 설정 및 커서 필터링
        if cursor and cursor != "None":
            # 커서 값을 적절한 타입으로 변환
            parsed_cursor = self._parse_cursor_value(cursor, queryset, field_name)

            if direction == "before":
                # 이전 데이터 (커서보다 작은 값) 요청 시:
                # 커서보다 작은 값 중에서 가장 큰 값들부터 가져오기 위해 내림차순 정렬
                queryset = queryset.filter(**{f"{field_name}__lt": parsed_cursor})
                # 내림차순 정렬 (예: 27, 26, 25... 순) - 커서 바로 아래부터 가져옴
                queryset = queryset.order_by(f"-{field_name}")

            elif direction == "after":
                # 다음 데이터 (커서보다 큰 값) 요청 시:
                # 커서보다 큰 값 중에서 가장 작은 값들부터 가져오기 위해 오름차순 정렬
                queryset = queryset.filter(**{f"{field_name}__gt": parsed_cursor})
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

        # 3. 페이지네이션 상태 계산
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
            # before 방향에서 has_next는 "더 오래된 데이터가 있는가" = limit+1개를 가져왔는가
            has_next = len(paginated_items) > limit
            # before 방향에서 has_prev는 "더 최신 데이터가 있는가" = 커서가 있었으므로 True
            has_prev = True

            # 'next' 커서는 리스트의 마지막 항목을 기준으로 설정 (더 오래된 데이터 요청용)
            next_cursor = self._get_cursor_value(items_list[-1], field_name) if has_next and items_list else None
            # 'prev' 커서는 리스트의 첫 번째 항목을 기준으로 설정 (더 최신 데이터 요청용)
            prev_cursor = self._get_cursor_value(items_list[0], field_name) if has_prev and items_list else None


        return {
            "items": items_list,
            "next_cursor": next_cursor,
            "prev_cursor": prev_cursor,
            "has_next": has_next,
            "has_prev": has_prev,
        }
