from ninja import NinjaAPI, Schema
from ninja.security import HttpBearer
from django.contrib.auth import authenticate
from django.http import JsonResponse
from users.models import User
import jwt
from datetime import datetime, timedelta
from django.conf import settings
from typing import Optional
from pydantic import BaseModel

class JWTAuth(HttpBearer):
    def authenticate(self, request, token: str) -> Optional[User]:
        print(f"Authenticating with token: {token}")
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = User.objects.get(id=payload['user_id'])
            print(f"Authenticated user: {user.username}")
            return user
        except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist) as e:
            print(f"Authentication failed: {e}")
            return None

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

class ProtectedResponse(Schema):
    message: str

api = NinjaAPI(auth=JWTAuth(), urls_namespace='api')

# 로그인 엔드포인트
@api.post("/login", response=LoginResponse, auth=None)
def login(request, data: LoginRequest):
    user = authenticate(username=data.username, password=data.password)
    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    
    payload = {
        'user_id': user.id,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow(),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    
    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user.pk,
            username=user.username,
            email=user.email,
        )
    )

# 보호된 엔드포인트 예시
@api.get("/protected", response=ProtectedResponse)
def protected(request):
    print(f"Request user: {request.user}, auth: {request.auth}, username: {request.auth.username if request.auth else 'None'}")
    return ProtectedResponse(message=f"Hello, {request.auth.username}!")

# 사용자 정보
@api.get("/me", response=UserResponse)
def me(request):
    user = request.auth
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
    )