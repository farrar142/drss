from typing import Optional
import feedparser
import requests
import re
from urllib.parse import urlparse
from datetime import datetime, timedelta
from django.utils import timezone as django_timezone


# 다양한 날짜 형식 패턴들
DATE_FORMATS = [
    # ISO 8601
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    # 한국 형식
    "%Y년 %m월 %d일 %H:%M:%S",
    "%Y년 %m월 %d일 %H:%M",
    "%Y년 %m월 %d일",
    "%Y.%m.%d %H:%M:%S",
    "%Y.%m.%d %H:%M",
    "%Y.%m.%d",
    # 미국 형식
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%d %B %Y",
    "%d %b %Y",
    # RSS/Atom 형식
    "%a, %d %b %Y %H:%M:%S %z",
    "%a, %d %b %Y %H:%M:%S",
    "%d %b %Y %H:%M:%S %z",
    "%d %b %Y %H:%M:%S",
]

# 상대 시간 패턴들 (한국어)
RELATIVE_TIME_PATTERNS_KO = [
    (r"(\d+)\s*초\s*전", lambda m: timedelta(seconds=int(m.group(1)))),
    (r"(\d+)\s*분\s*전", lambda m: timedelta(minutes=int(m.group(1)))),
    (r"(\d+)\s*시간\s*전", lambda m: timedelta(hours=int(m.group(1)))),
    (r"(\d+)\s*일\s*전", lambda m: timedelta(days=int(m.group(1)))),
    (r"(\d+)\s*주\s*전", lambda m: timedelta(weeks=int(m.group(1)))),
    (r"(\d+)\s*개월\s*전", lambda m: timedelta(days=int(m.group(1)) * 30)),
    (r"(\d+)\s*달\s*전", lambda m: timedelta(days=int(m.group(1)) * 30)),
    (r"어제", lambda m: timedelta(days=1)),
    (r"오늘", lambda m: timedelta(days=0)),
    (r"방금", lambda m: timedelta(seconds=0)),
]

# 상대 시간 패턴들 (영어)
RELATIVE_TIME_PATTERNS_EN = [
    (r"(\d+)\s*seconds?\s*ago", lambda m: timedelta(seconds=int(m.group(1)))),
    (r"(\d+)\s*minutes?\s*ago", lambda m: timedelta(minutes=int(m.group(1)))),
    (r"(\d+)\s*hours?\s*ago", lambda m: timedelta(hours=int(m.group(1)))),
    (r"(\d+)\s*days?\s*ago", lambda m: timedelta(days=int(m.group(1)))),
    (r"(\d+)\s*weeks?\s*ago", lambda m: timedelta(weeks=int(m.group(1)))),
    (r"(\d+)\s*months?\s*ago", lambda m: timedelta(days=int(m.group(1)) * 30)),
    (r"(\d+)\s*years?\s*ago", lambda m: timedelta(days=int(m.group(1)) * 365)),
    (r"yesterday", lambda m: timedelta(days=1)),
    (r"today", lambda m: timedelta(days=0)),
    (r"just\s*now", lambda m: timedelta(seconds=0)),
    (r"a\s*minute\s*ago", lambda m: timedelta(minutes=1)),
    (r"an?\s*hour\s*ago", lambda m: timedelta(hours=1)),
    (r"a\s*day\s*ago", lambda m: timedelta(days=1)),
    (r"a\s*week\s*ago", lambda m: timedelta(weeks=1)),
]


def parse_date(
    date_text: str, date_formats: Optional[list[str]] = None
) -> Optional[datetime]:
    """
    다양한 형식의 날짜 문자열을 파싱하여 datetime 객체로 반환합니다.

    Args:
        date_text: 파싱할 날짜 문자열
        date_formats: 사용자 지정 날짜 형식 목록 (옵션)

    Returns:
        파싱된 datetime 객체 (timezone aware) 또는 None
    """
    if not date_text:
        return None

    date_text = date_text.strip()
    now = django_timezone.now()

    # 1. 사용자 지정 형식이 있으면 먼저 시도 (여러 포맷 순차 시도)
    if date_formats:
        for date_format in date_formats:
            if not date_format:
                continue
            try:
                parsed = datetime.strptime(date_text, date_format)
                if django_timezone.is_naive(parsed):
                    parsed = django_timezone.make_aware(parsed)
                return parsed
            except ValueError:
                continue

    # 2. 상대 시간 패턴 확인 (한국어)
    for pattern, delta_fn in RELATIVE_TIME_PATTERNS_KO:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            delta = delta_fn(match)
            return now - delta

    # 3. 상대 시간 패턴 확인 (영어)
    for pattern, delta_fn in RELATIVE_TIME_PATTERNS_EN:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            delta = delta_fn(match)
            return now - delta

    # 4. 절대 날짜 형식 시도
    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(date_text, fmt)
            if django_timezone.is_naive(parsed):
                parsed = django_timezone.make_aware(parsed)
            return parsed
        except ValueError:
            continue

    # 5. 숫자만 있는 경우 (예: "20231215", "2023121512", "202312151230")
    digits = re.sub(r"\D", "", date_text)
    if len(digits) >= 8:
        try:
            if len(digits) == 8:  # YYYYMMDD
                parsed = datetime.strptime(digits, "%Y%m%d")
            elif len(digits) == 10:  # YYYYMMDDHH
                parsed = datetime.strptime(digits, "%Y%m%d%H")
            elif len(digits) == 12:  # YYYYMMDDHHMM
                parsed = datetime.strptime(digits, "%Y%m%d%H%M")
            elif len(digits) >= 14:  # YYYYMMDDHHMMSS
                parsed = datetime.strptime(digits[:14], "%Y%m%d%H%M%S")
            else:
                parsed = None

            if parsed:
                if django_timezone.is_naive(parsed):
                    parsed = django_timezone.make_aware(parsed)
                return parsed
        except ValueError:
            pass

    # 6. dateutil 라이브러리 시도 (설치되어 있다면)
    try:
        from dateutil import parser as dateutil_parser

        parsed = dateutil_parser.parse(date_text, fuzzy=True)
        if django_timezone.is_naive(parsed):
            parsed = django_timezone.make_aware(parsed)
        return parsed
    except Exception:
        pass

    return None


def fetch_feed_data(url: str, custom_headers: Optional[dict] = None):
    """
    RSS 피드를 가져와 파싱하는 공통 함수
    """
    if custom_headers is None:
        custom_headers = {}

    # Custom headers를 포함한 요청
    headers = {"User-Agent": "RSS Reader/1.0"}
    headers.update(custom_headers)

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    # RSS 파싱
    feed = feedparser.parse(response.content)

    if feed.bozo:  # 파싱 에러
        raise Exception("Invalid RSS feed")

    return feed


def extract_favicon_url(url: str, headers: Optional[dict] = None):
    """
    주어진 URL에서 favicon URL을 추출하는 함수
    """
    if headers is None:
        headers = {"User-Agent": "RSS Reader/1.0"}

    try:
        parsed_url = urlparse(url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

        # favicon.ico 시도
        favicon_response = requests.get(f"{base_url}/favicon.ico", timeout=5)
        if favicon_response.status_code == 200:
            return f"{base_url}/favicon.ico"

        # HTML에서 favicon 링크 찾기 시도
        html_response = requests.get(base_url, headers=headers, timeout=10)
        if html_response.status_code == 200:
            html_content = html_response.text
            # rel="icon" 또는 rel="shortcut icon" 찾기
            favicon_match = re.search(
                r'<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]+href=["\']([^"\']+)["\']',
                html_content,
                re.IGNORECASE,
            )
            if favicon_match:
                favicon_href = favicon_match.group(1)
                if favicon_href.startswith("http"):
                    return favicon_href
                elif favicon_href.startswith("//"):
                    return f"{parsed_url.scheme}:{favicon_href}"
                elif favicon_href.startswith("/"):
                    return f"{base_url}{favicon_href}"
                else:
                    return f"{base_url}/{favicon_href}"
    except Exception:
        # Favicon 추출 실패 시 None 반환
        pass

    return ""
