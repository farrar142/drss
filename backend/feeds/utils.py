import feedparser
import requests
import re
from urllib.parse import urlparse


def fetch_feed_data(url: str, custom_headers: dict = None):
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


def extract_favicon_url(url: str, headers: dict = None):
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
