"""
TrumpSays – News Fetcher
Pulls Trump statements from RSS feeds and news sources.
"""

import feedparser
import urllib.request
import json
import re
from datetime import datetime, timezone
from typing import Optional


RSS_FEEDS = {
    "Google News – Trump": "https://news.google.com/rss/search?q=Trump+says+announces&hl=en-US&gl=US&ceid=US:en",
    "Google News – Trump Trade": "https://news.google.com/rss/search?q=Trump+tariff+trade+deal+company&hl=en-US&gl=US&ceid=US:en",
    "Google News – Trump Speech": "https://news.google.com/rss/search?q=Trump+speech+press+conference&hl=en-US&gl=US&ceid=US:en",
    "Truth Social (via RSS bridge)": "https://truthsocial.com/@realDonaldTrump.rss",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    )
}


def _fetch_feed(url: str) -> list[dict]:
    """Fetch and parse a single RSS feed. Returns list of article dicts."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        feed = feedparser.parse(data)
        entries = []
        for entry in feed.entries:
            entries.append({
                "title": entry.get("title", ""),
                "summary": _strip_html(entry.get("summary", "")),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "source": feed.feed.get("title", "Unknown"),
            })
        return entries
    except Exception as e:
        print(f"  [warn] Feed fetch failed ({url[:60]}...): {e}")
        return []


def _strip_html(text: str) -> str:
    """Remove HTML tags from text."""
    return re.sub(r"<[^>]+>", "", text).strip()


def fetch_statements(max_per_feed: int = 10) -> list[dict]:
    """
    Fetch recent Trump-related statements from all configured feeds.
    Returns deduplicated list sorted by date (newest first).
    """
    all_entries = []
    seen_titles = set()

    for name, url in RSS_FEEDS.items():
        print(f"Fetching: {name}")
        entries = _fetch_feed(url)
        for e in entries[:max_per_feed]:
            key = e["title"][:60].lower()
            if key not in seen_titles:
                seen_titles.add(key)
                all_entries.append(e)

    # Sort newest first (best-effort)
    def parse_date(entry: dict) -> datetime:
        try:
            import email.utils
            t = email.utils.parsedate_to_datetime(entry["published"])
            return t
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)

    all_entries.sort(key=parse_date, reverse=True)
    return all_entries


if __name__ == "__main__":
    results = fetch_statements()
    print(f"\nFetched {len(results)} statements\n")
    for r in results[:5]:
        print(f"[{r['source']}] {r['title'][:100]}")
        print(f"  {r['summary'][:120]}\n")
