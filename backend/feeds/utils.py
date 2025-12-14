import feedparser
import requests


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