from ninja import Schema, Router
from ninja import errors
from django.contrib.auth import authenticate
from django.http import JsonResponse
import jwt
from datetime import timedelta
from django.conf import settings
from django.utils import timezone

from base.authentications import JWTAuth
from users.services.setting_service import SettingService


class LoginRequest(Schema):
    username: str
    password: str


class UserResponse(Schema):
    id: int
    username: str
    email: str
    is_staff: bool
    is_superuser: bool


class LoginResponse(Schema):
    token: str
    user: UserResponse


class SignupResponse(Schema):
    token: str
    user: UserResponse


class SignupRequest(Schema):
    username: str
    password: str
    email: str


class ProtectedResponse(Schema):
    message: str


router = Router()


# 로그인 엔드포인트
@router.post("/login", response=LoginResponse, auth=None)
def login(request, data: LoginRequest):
    user = authenticate(username=data.username, password=data.password)
    if user is None:
        raise errors.AuthenticationError(message="Invalid credentials")

    payload = {
        "user_id": user.pk,
        "exp": timezone.now() + timedelta(days=365),
        "iat": timezone.now(),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user.pk,
            username=user.username,
            email=user.email,
            is_staff=user.is_staff,
            is_superuser=user.is_superuser,
        ),
    )


@router.post("/signup", response=SignupResponse, auth=None)
def signup(request, data: SignupRequest):
    from users.models import User

    # 회원가입 허용 여부 확인
    if not SettingService.is_signup_allowed():
        raise errors.AuthorizationError(message="회원가입이 비활성화되어 있습니다.")

    if User.objects.filter(username=data.username).exists():
        raise errors.AuthorizationError(message="Username already exists")
    is_superuser = User.objects.all().exists()
    user = User.objects.create_user(
        username=data.username,
        password=data.password,
        email=data.email,
        is_staff=is_superuser,
        is_superuser=is_superuser,
    )

    payload = {
        "user_id": user.pk,
        "exp": timezone.now() + timedelta(days=365),
        "iat": timezone.now(),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    return SignupResponse(
        token=token,
        user=UserResponse(
            id=user.pk,
            username=user.username,
            email=user.email,
            is_staff=user.is_staff,
            is_superuser=user.is_superuser,
        ),
    )


# 보호된 엔드포인트 예시
@router.get("/protected", response=ProtectedResponse, auth=JWTAuth())
def protected(request):
    return ProtectedResponse(message=f"Hello, {request.auth.username}!")


# 사용자 정보
@router.get("/me", response=UserResponse, auth=JWTAuth())
def me(request):
    user = request.auth
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_staff=user.is_staff,
        is_superuser=user.is_superuser,
    )


# ===== 관리자 설정 API =====


class GlobalSettingSchema(Schema):
    """글로벌 설정 스키마"""

    allow_signup: bool
    site_name: str
    max_feeds_per_user: int
    default_refresh_interval: int


class GlobalSettingUpdateSchema(Schema):
    """글로벌 설정 업데이트 스키마 (부분 업데이트 가능)"""

    allow_signup: bool | None = None
    site_name: str | None = None
    max_feeds_per_user: int | None = None
    default_refresh_interval: int | None = None


def require_admin(user):
    """관리자 권한 확인"""
    if not user.is_staff and not user.is_superuser:
        raise errors.AuthorizationError(message="관리자 권한이 필요합니다.")


@router.get("/admin/settings", response=GlobalSettingSchema, auth=JWTAuth())
def get_global_settings(request):
    """글로벌 설정 조회 (관리자 전용)"""
    require_admin(request.auth)
    setting = SettingService.get_global_setting()
    return GlobalSettingSchema(
        allow_signup=setting.allow_signup,
        site_name=setting.site_name,
        max_feeds_per_user=setting.max_feeds_per_user,
        default_refresh_interval=setting.default_refresh_interval,
    )


@router.patch("/admin/settings", response=GlobalSettingSchema, auth=JWTAuth())
def update_global_settings(request, data: GlobalSettingUpdateSchema):
    """글로벌 설정 업데이트 (관리자 전용)"""
    require_admin(request.auth)

    # None이 아닌 필드만 업데이트
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    setting = SettingService.update_settings(update_data)

    return GlobalSettingSchema(
        allow_signup=setting.allow_signup,
        site_name=setting.site_name,
        max_feeds_per_user=setting.max_feeds_per_user,
        default_refresh_interval=setting.default_refresh_interval,
    )


# 회원가입 가능 여부 공개 API (인증 불필요)
class SignupStatusSchema(Schema):
    allow_signup: bool
    site_name: str


@router.get("/signup-status", response=SignupStatusSchema, auth=None)
def get_signup_status(request):
    """회원가입 허용 여부 및 사이트 정보 확인 (공개 API)"""
    setting = SettingService.get_global_setting()
    return SignupStatusSchema(
        allow_signup=setting.allow_signup,
        site_name=setting.site_name,
    )


# 사용자용 설정 API (인증 필요, 관리자 아니어도 됨)
class UserSettingsSchema(Schema):
    """일반 사용자가 볼 수 있는 설정"""
    max_feeds_per_user: int
    default_refresh_interval: int


@router.get("/user-settings", response=UserSettingsSchema, auth=JWTAuth())
def get_user_settings(request):
    """사용자용 설정 조회 (피드 생성 시 필요한 제한값 등)"""
    setting = SettingService.get_global_setting()
    return UserSettingsSchema(
        max_feeds_per_user=setting.max_feeds_per_user,
        default_refresh_interval=setting.default_refresh_interval,
    )
