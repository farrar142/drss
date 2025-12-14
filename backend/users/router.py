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
        "exp": timezone.now() + timedelta(hours=1),
        "iat": timezone.now(),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user.pk,
            username=user.username,
            email=user.email,
        ),
    )


@router.post("/signup", response=SignupResponse, auth=None)
def signup(request, data: SignupRequest):
    from users.models import User

    if SettingService.get_global_setting().admin_signed:
        raise errors.AuthorizationError(message="Admin has already signed up.")

    if User.objects.filter(username=data.username).exists():
        raise errors.AuthorizationError(message="Username already exists")

    user = User.objects.create_user(
        username=data.username, password=data.password, email=data.email
    )
    SettingService.set_admin_signed(True)

    payload = {
        "user_id": user.pk,
        "exp": timezone.now() + timedelta(hours=1),
        "iat": timezone.now(),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    return SignupResponse(
        token=token,
        user=UserResponse(
            id=user.pk,
            username=user.username,
            email=user.email,
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
    )
