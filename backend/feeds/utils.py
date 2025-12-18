"""
Feeds Utilities Module (Backward Compatibility)

이 모듈은 하위 호환성을 위해 유지됩니다.
새로운 코드에서는 feeds.utils 패키지를 직접 import하세요:
    from feeds.utils import parse_date, fetch_feed_data, extract_favicon_url
    from feeds.utils import generate_rss_xml, generate_atom_xml

또는 개별 모듈을 import하세요:
    from feeds.utils.date_parser import parse_date
    from feeds.utils.feed_fetcher import fetch_feed_data
    from feeds.utils.rss_generator import generate_rss_xml
"""

# Re-export all utilities from the new package structure
from feeds.utils.date_parser import (
    parse_date,
    DATE_FORMATS,
    RELATIVE_TIME_PATTERNS_KO,
    RELATIVE_TIME_PATTERNS_EN,
)
from feeds.utils.feed_fetcher import fetch_feed_data, extract_favicon_url
from feeds.utils.rss_generator import generate_rss_xml, generate_atom_xml

__all__ = [
    "parse_date",
    "DATE_FORMATS",
    "RELATIVE_TIME_PATTERNS_KO",
    "RELATIVE_TIME_PATTERNS_EN",
    "fetch_feed_data",
    "extract_favicon_url",
    "generate_rss_xml",
    "generate_atom_xml",
]
