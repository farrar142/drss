from typing import Optional
import jwt

from django.conf import settings
from django.contrib.auth import get_user_model

from ninja.security import HttpBearer

from users.models import User


class JWTAuth(HttpBearer):
    def authenticate(self, request, token: str) -> Optional[User]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user = User.objects.get(id=payload["user_id"])
            return user
        except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist) as e:
            return None
