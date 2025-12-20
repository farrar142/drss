"""HTML 유틸리티 함수들"""
import re
from html import unescape


def strip_html_tags(html: str) -> str:
    """
    HTML 문자열에서 태그를 제거하고 순수 텍스트만 반환합니다.

    Args:
        html: HTML 문자열

    Returns:
        HTML 태그가 제거된 순수 텍스트
    """
    if not html:
        return ""

    # script, style 태그와 그 내용 제거
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # HTML 주석 제거
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # 모든 HTML 태그 제거
    text = re.sub(r'<[^>]+>', ' ', text)

    # HTML 엔티티 디코딩 (예: &amp; -> &, &lt; -> <)
    text = unescape(text)

    # 연속된 공백을 단일 공백으로
    text = re.sub(r'\s+', ' ', text)

    # 앞뒤 공백 제거
    return text.strip()
