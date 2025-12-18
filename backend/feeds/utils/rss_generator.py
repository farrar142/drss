"""
RSS/Atom XML Generator Utilities

RSS 2.0 및 Atom 1.0 피드 XML을 생성하는 유틸리티 함수들
"""

from typing import TYPE_CHECKING
from xml.etree.ElementTree import Element, SubElement, tostring
from datetime import datetime
from email.utils import format_datetime

if TYPE_CHECKING:
    from feeds.models import RSSItem


def generate_rss_xml(
    items: list["RSSItem"],
    title: str,
    link: str,
    description: str,
) -> str:
    """
    RSS 2.0 형식의 XML을 생성합니다.

    Args:
        items: RSSItem 목록
        title: 피드 제목
        link: 피드 링크
        description: 피드 설명

    Returns:
        RSS 2.0 XML 문자열
    """
    rss = Element("rss", version="2.0")
    channel = SubElement(rss, "channel")

    # Channel metadata
    SubElement(channel, "title").text = title
    SubElement(channel, "link").text = link
    SubElement(channel, "description").text = description
    SubElement(channel, "lastBuildDate").text = format_datetime(datetime.now())

    # Items
    for item in items:
        item_elem = SubElement(channel, "item")
        SubElement(item_elem, "title").text = item.title
        SubElement(item_elem, "link").text = item.link
        SubElement(item_elem, "description").text = item.description or ""
        SubElement(item_elem, "guid").text = item.guid

        if item.published_at:
            SubElement(item_elem, "pubDate").text = format_datetime(item.published_at)

        if item.author:
            SubElement(item_elem, "author").text = item.author

        # Media enclosure (image)
        if item.image:
            SubElement(
                item_elem,
                "enclosure",
                url=item.image,
                type="image/jpeg",
                length="0",
            )

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(
        rss, encoding="unicode"
    )


def generate_atom_xml(
    items: list["RSSItem"],
    title: str,
    link: str,
    feed_id: str,
) -> str:
    """
    Atom 1.0 형식의 XML을 생성합니다.

    Args:
        items: RSSItem 목록
        title: 피드 제목
        link: 피드 링크
        feed_id: 피드 고유 ID

    Returns:
        Atom 1.0 XML 문자열
    """
    feed = Element("feed", xmlns="http://www.w3.org/2005/Atom")

    # Feed metadata
    SubElement(feed, "title").text = title
    SubElement(feed, "link", href=link, rel="alternate")
    SubElement(feed, "id").text = f"tag:drss.app,2024:{feed_id}"
    SubElement(feed, "updated").text = datetime.now().isoformat() + "Z"

    # Entries
    for item in items:
        entry = SubElement(feed, "entry")
        SubElement(entry, "title").text = item.title
        SubElement(entry, "link", href=item.link)
        SubElement(entry, "id").text = item.guid

        if item.published_at:
            SubElement(entry, "published").text = item.published_at.isoformat()
            SubElement(entry, "updated").text = item.published_at.isoformat()

        if item.author:
            author_elem = SubElement(entry, "author")
            SubElement(author_elem, "name").text = item.author

        if item.description:
            SubElement(entry, "summary", type="html").text = item.description

        # Image as link with media type
        if item.image:
            SubElement(
                entry,
                "link",
                href=item.image,
                rel="enclosure",
                type="image/jpeg",
            )

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(
        feed, encoding="unicode"
    )
