"""
MinIO 이미지 스토리지 서비스
RSS 피드의 이미지를 MinIO에 스트리밍 업로드하고 URL을 반환합니다.
"""
import hashlib
import mimetypes
import os
from io import BytesIO
from logging import getLogger
from typing import Optional
from urllib.parse import urlparse, urljoin

import boto3
import requests
from botocore.exceptions import ClientError
from django.conf import settings

logger = getLogger(__name__)


class ImageStorageService:
    """MinIO/S3에 이미지를 스트리밍 업로드하는 서비스"""

    IMAGES_PREFIX = "images"  # MinIO 버킷 내 이미지 저장 경로
    CHUNK_SIZE = 8192  # 스트리밍 청크 사이즈
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 최대 10MB
    ALLOWED_CONTENT_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "image/avif",
    }

    def __init__(self):
        """S3/MinIO 클라이언트 초기화"""
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        self.endpoint_url = settings.AWS_S3_ENDPOINT_URL
        # 브라우저에서 접근 가능한 public URL (환경변수로 설정)
        self.public_url = os.getenv(
            "MINIO_PUBLIC_URL",
            os.getenv("MINIO_PUBLIC_ENDPOINT", self.endpoint_url)
        ).rstrip("/")

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=os.getenv("AWS_S3_REGION_NAME", "us-east-1"),
        )

    def _get_public_url(self, key: str) -> str:
        """MinIO 오브젝트의 public URL 반환"""
        return f"{self.public_url}/{self.bucket_name}/{key}"

    def _generate_image_key(
        self, image_url: str, content_type: str, feed_id: Optional[int] = None, item_id: Optional[int] = None
    ) -> str:
        """
        이미지 URL에서 고유한 파일 키 생성
        /images/{feed_id}/{item_id}/hash.ext 형식
        """
        # URL 해시로 고유 ID 생성
        url_hash = hashlib.sha256(image_url.encode()).hexdigest()[:16]

        # 확장자 결정
        ext = self._get_extension(image_url, content_type)

        # 디렉토리 구조: images / feed_id / item_id / 파일명
        if feed_id and item_id:
            return f"{self.IMAGES_PREFIX}/{feed_id}/{item_id}/{url_hash}{ext}"
        elif feed_id:
            return f"{self.IMAGES_PREFIX}/{feed_id}/{url_hash}{ext}"
        return f"{self.IMAGES_PREFIX}/{url_hash}{ext}"

    def _get_extension(self, url: str, content_type: str) -> str:
        """URL 또는 Content-Type에서 확장자 추출"""
        # Content-Type에서 확장자 추출 시도
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext:
            return ext

        # URL에서 확장자 추출 시도
        parsed = urlparse(url)
        path = parsed.path.lower()
        for known_ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]:
            if path.endswith(known_ext):
                return known_ext

        return ".jpg"  # 기본값

    def _check_existing(self, key: str) -> bool:
        """이미 업로드된 파일인지 확인"""
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False

    def upload_image_from_url(
        self,
        image_url: str,
        base_url: Optional[str] = None,
        feed_id: Optional[int] = None,
        item_id: Optional[int] = None,
    ) -> Optional[str]:
        """
        URL에서 이미지를 스트리밍으로 다운로드하여 MinIO에 업로드

        Args:
            image_url: 이미지 원본 URL
            base_url: 상대 URL인 경우 기준이 되는 URL
            feed_id: 피드 ID (이미지 경로에 포함)
            item_id: 아이템 ID (이미지 경로에 포함)

        Returns:
            MinIO 내 이미지 경로 (/images/{feed_id}/{item_id}/hash.ext) 또는 None
        """
        # 상대 URL 처리
        if base_url and not image_url.startswith(("http://", "https://")):
            image_url = urljoin(base_url, image_url)

        # data: URL 스킵
        if image_url.startswith("data:"):
            return None

        # http/https가 아니면 스킵
        if not image_url.startswith(("http://", "https://")):
            return None

        try:
            # 스트리밍으로 이미지 다운로드
            response = requests.get(
                image_url,
                stream=True,
                timeout=30,
                headers={
                    "User-Agent": "DRSS-ImageUploader/1.0",
                    "Accept": "image/*,*/*;q=0.8",
                },
            )
            response.raise_for_status()

            # Content-Type 확인
            content_type = response.headers.get("Content-Type", "image/jpeg")
            if content_type.split(";")[0].strip() not in self.ALLOWED_CONTENT_TYPES:
                logger.warning(f"Skipping non-image content: {content_type} for {image_url}")
                return None

            # Content-Length 확인 (있는 경우)
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > self.MAX_IMAGE_SIZE:
                logger.warning(f"Image too large: {content_length} bytes for {image_url}")
                return None

            # 이미지 키 생성
            key = self._generate_image_key(image_url, content_type, feed_id, item_id)

            # 이미 존재하면 업로드 스킵
            if self._check_existing(key):
                logger.debug(f"Image already exists: {key}")
                return self._get_public_url(key)

            # 스트리밍으로 메모리에 로드
            buffer = BytesIO()
            downloaded_size = 0

            for chunk in response.iter_content(chunk_size=self.CHUNK_SIZE):
                downloaded_size += len(chunk)
                if downloaded_size > self.MAX_IMAGE_SIZE:
                    logger.warning(f"Image too large during download: {image_url}")
                    return None
                buffer.write(chunk)

            buffer.seek(0)

            # MinIO에 업로드
            self.s3_client.upload_fileobj(
                buffer,
                self.bucket_name,
                key,
                ExtraArgs={
                    "ContentType": content_type,
                    "CacheControl": "max-age=31536000",  # 1년 캐시
                },
            )

            logger.info(f"Uploaded image: {image_url} -> {key}")
            return self._get_public_url(key)

        except requests.RequestException as e:
            logger.warning(f"Failed to download image {image_url}: {e}")
            return None
        except ClientError as e:
            logger.error(f"Failed to upload image to MinIO: {e}")
            return None
        except Exception as e:
            logger.exception(f"Unexpected error uploading image {image_url}: {e}")
            return None

    def upload_images_and_replace_html(
        self,
        html_content: str,
        base_url: Optional[str] = None,
        feed_id: Optional[int] = None,
        item_id: Optional[int] = None,
    ) -> tuple[str, int]:
        """
        HTML 내의 모든 이미지를 MinIO에 업로드하고 URL을 교체

        Args:
            html_content: HTML 문자열
            base_url: 상대 URL 기준 (디테일 페이지 URL)
            feed_id: 피드 ID (이미지 경로에 포함)
            item_id: 아이템 ID (이미지 경로에 포함)

        Returns:
            (교체된 HTML, 교체된 이미지 수)
        """
        from bs4 import BeautifulSoup

        if not html_content:
            return html_content, 0

        soup = BeautifulSoup(html_content, "html.parser")
        img_tags = soup.find_all("img")

        replaced_count = 0

        for img in img_tags:
            src = img.get("src")
            if not src:
                continue

            # MinIO 경로로 업로드
            new_path = self.upload_image_from_url(src, base_url, feed_id, item_id)

            if new_path:
                img["src"] = new_path
                # data-src 속성도 교체 (lazy loading 대응)
                if img.get("data-src"):
                    img["data-src"] = new_path
                replaced_count += 1

        return str(soup), replaced_count


# 싱글톤 인스턴스 (옵션)
_image_storage_service: Optional[ImageStorageService] = None


def get_image_storage_service() -> ImageStorageService:
    """ImageStorageService 싱글톤 인스턴스 반환"""
    global _image_storage_service
    if _image_storage_service is None:
        _image_storage_service = ImageStorageService()
    return _image_storage_service
