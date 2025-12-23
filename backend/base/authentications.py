from typing import Optional
from django.http import HttpRequest
import jwt

from django.conf import settings
from django.contrib.auth import get_user_model

from ninja.security import HttpBearer

from users.models import User


class JWTAuth(HttpBearer):
    def authenticate(self, request: HttpRequest, token: str) -> Optional[User]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user = User.objects.get(id=payload["user_id"])
            return user
        except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist) as e:
            return None


async def async_jwt(request: HttpRequest):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    try:
        scheme, token = auth_header.split()
        if scheme.lower() != "bearer":
            return None

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user = await get_user_model().objects.aget(id=payload["user_id"])
        return user
    except (jwt.ExpiredSignatureError, jwt.DecodeError, get_user_model().DoesNotExist):
        return None
