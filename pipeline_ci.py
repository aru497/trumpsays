"""
TrumpSays – CI Pipeline
Runs in GitHub Actions every 30 minutes.
No spaCy needed — uses lookup table only (fast, no model download).
Writes docs/data.json which GitHub Pages serves.
"""

import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Output path (GitHub Pages serves from /docs) ─────────────────────────────
OUT = Path(__file__).parent / "docs" / "data.json"
OUT.parent.mkdir(exist_ok=True)

# ── Company → Ticker lookup (no ML needed) ────────────────────────────────────
TICKERS = {
    # Tech
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL", "alphabet": "GOOGL",
    "amazon": "AMZN", "meta": "META", "facebook": "META", "nvidia": "NVDA",
    "tesla": "TSLA", "netflix": "NFLX", "intel": "INTC", "amd": "AMD",
    "qualcomm": "QCOM", "ibm": "IBM", "oracle": "ORCL", "salesforce": "CRM",
    "adobe": "ADBE", "zoom": "ZM", "twitter": "X", "x corp": "X",
    "openai": None, "tiktok": None, "bytedance": None, "palantir": "PLTR",
    "snowflake": "SNOW", "uber": "UBER", "lyft": "LYFT", "airbnb": "ABNB",
    "shopify": "SHOP", "spotify": "SPOT", "pinterest": "PINS",
    # Finance
    "jpmorgan": "JPM", "jp morgan": "JPM", "goldman sachs": "GS",
    "bank of america": "BAC", "wells fargo": "WFC", "morgan stanley": "MS",
    "citigroup": "C", "citi": "C", "blackrock": "BLK", "berkshire": "BRK-B",
    "visa": "V", "mastercard": "MA", "american express": "AXP",
    "coinbase": "COIN", "robinhood": "HOOD", "paypal": "PYPL",
    # Energy
    "exxon": "XOM", "exxonmobil": "XOM", "chevron": "CVX",
    "conocophillips": "COP", "halliburton": "HAL", "bp": "BP", "shell": "SHEL",
    "marathon oil": "MRO", "pioneer natural": "PXD",
    # Defense
    "lockheed": "LMT", "lockheed martin": "LMT", "raytheon": "RTX",
    "boeing": "BA", "northrop": "NOC", "northrop grumman": "NOC",
    "general dynamics": "GD", "l3harris": "LHX", "textron": "TXT",
    # Retail / Consumer
    "walmart": "WMT", "target": "TGT", "costco": "COST",
    "home depot": "HD", "lowe's": "LOW", "lowes": "LOW",
    "mcdonald's": "MCD", "mcdonalds": "MCD", "starbucks": "SBUX",
    "coca-cola": "KO", "coca cola": "KO", "coke": "KO",
    "pepsi": "PEP", "pepsico": "PEP", "nike": "NKE", "gap": "GPS",
    "dollar general": "DG", "dollar tree": "DLTR",
    # Auto
    "ford": "F", "general motors": "GM", "gm": "GM", "stellantis": "STLA",
    "rivian": "RIVN", "lucid": "LCID",
    # Pharma / Health
    "pfizer": "PFE", "johnson & johnson": "JNJ", "johnson and johnson": "JNJ",
    "unitedhealth": "UNH", "cvs": "CVS", "moderna": "MRNA",
    "eli lilly": "LLY", "merck": "MRK", "abbvie": "ABBV", "amgen": "AMGN",
    # Media / Telecom
    "disney": "DIS", "comcast": "CMCSA", "at&t": "T", "att": "T",
    "verizon": "VZ", "fox": "FOX", "fox news": "FOX",
    "new york times": "NYT", "nyt": "NYT", "warner bros": "WBD",
    # Industrial
    "caterpillar": "CAT", "deere": "DE", "john deere": "DE",
    "3m": "MMM", "honeywell": "HON", "ge": "GE", "general electric": "GE",
    "ups": "UPS", "fedex": "FDX",
    # Airlines
    "delta": "DAL", "united airlines": "UAL", "american airlines": "AAL",
    "southwest": "LUV",
    # China
    "huawei": None, "tencent": "TCEHY", "alibaba": "BABA", "xiaomi": "XIACY",
    # Steel / Tariff targets
    "u.s. steel": "X", "us steel": "X", "nucor": "NUE", "steel dynamics": "STLD",
}

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TrumpSays/1.0)"}

RSS_FEEDS = [
    # Reuters - CI-friendly, no blocking
    ("Reuters Business",     "https://feeds.reuters.com/reuters/businessNews",                                              "news"),
    ("Reuters Top News",     "https://feeds.reuters.com/reuters/topNews",                                                   "news"),
    # AP News
    ("AP News",              "https://rsshub.app/apnews/topics/politics",                                                   "news"),
    # Politico
    ("Politico",             "https://rss.politico.com/politics-news.xml",                                                  "news"),
    # White House (try — may work in CI)
    ("White House",          "https://www.whitehouse.gov/feed/",                                                            "official"),
    # Truth Social
    ("Truth Social",         "https://truthsocial.com/@realDonaldTrump.rss",                                               "social"),
    # PBS NewsHour
    ("PBS NewsHour",         "https://www.pbs.org/newshour/feeds/rss/politics",                                             "news"),
    # NPR Politics
    ("NPR Politics",         "https://feeds.npr.org/1014/rss.xml",                                                         "news"),
]


def entry_image(e) -> str | None:
    """Pull a thumbnail/hero image straight from the RSS entry (no extra HTTP)."""
    # media:thumbnail / media:content
    for key in ("media_thumbnail", "media_content"):
        m = e.get(key)
        if isinstance(m, list) and m and m[0].get("url"):
            return m[0]["url"]
    # enclosure / <link rel=enclosure type=image/*>
    for l in e.get("links", []):
        if l.get("type", "").startswith("image") and l.get("href"):
            return l["href"]
    # first <img> inside summary/content HTML
    html = e.get("summary", "") or (e.get("content") or [{}])[0].get("value", "")
    m = re.search(r'<img[^>]+src=["\']([^"\']+)', html)
    if m:
        return m.group(1)
    return None


def fetch_articles() -> list[dict]:
    try:
        import feedparser
    except ImportError:
        sys.exit("feedparser not installed — pip install feedparser")

    seen, out = set(), []
    for name, url, src_type in RSS_FEEDS:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                data = r.read()
            feed = feedparser.parse(data)
            for e in feed.entries[:20]:
                t = re.sub(r"<[^>]+>", "", e.get("title", "")).strip()
                k = t[:60].lower()
                if not t or k in seen:
                    continue
                seen.add(k)
                body = re.sub(r"<[^>]+>", "",
                    e.get("summary", "") or
                    (e.get("content") or [{}])[0].get("value", ""))
                out.append({
                    "title":   t,
                    "body":    body[:800],
                    "link":    e.get("link", "#"),
                    "pub":     e.get("published", ""),
                    "source":  name,
                    "type":    src_type,
                    "image":   entry_image(e),
                })
            print(f"  ✓ {name}: {len(feed.entries)} items")
        except Exception as ex:
            print(f"  ✗ {name}: {ex}")
    return out


def find_companies(text: str) -> list[dict]:
    low = text.lower()
    found = []
    seen = set()
    for name, ticker in TICKERS.items():
        if re.search(r'\b' + re.escape(name) + r'\b', low):
            if name not in seen:
                seen.add(name)
                # grab surrounding context as snippet, snapped to whole words
                m = re.search(r'\b' + re.escape(name) + r'\b', low)
                s = max(0, m.start() - 60)
                e = min(len(text), m.end() + 60)
                snip = text[s:e]
                if s > 0 and " " in snip:           # drop partial leading word
                    snip = snip[snip.find(" ") + 1:]
                if e < len(text) and " " in snip:    # drop partial trailing word
                    snip = snip[:snip.rfind(" ")]
                found.append({
                    "company": name.title(),
                    "ticker":  ticker,
                    "snippet": snip.strip(),
                })
    return found


# ── Where did he say it? (channel / venue) ───────────────────────────────────
PRESSER_KW = (
    "press conference", "press briefing", "briefing room", "told reporters",
    "press secretary", "news conference", "press gaggle", "presser",
    "took questions", "press pool", "in the oval office", "to reporters",
)
SPEECH_KW = (
    "remarks", "in a speech", "delivered a speech", "rally", "addressed",
    "campaign event", "joint address", "state of the union", "town hall",
    "delivered remarks", "at a rally", "gave a speech", "his speech",
)


ATTRIB_KW = ("trump", "president", "potus", " he ", "white house")


def classify_channel(source: str, src_type: str, text: str) -> str:
    """Bucket a mention by WHERE Trump said it, so the site can filter on it."""
    low = (text or "").lower()
    s = (source or "").lower()
    if "truth social" in s or src_type == "social":
        return "Truth Social"
    # only call it a presser/speech when there's a Trump-attribution signal,
    # so a generic news story that merely contains "speech" isn't mislabelled
    attributed = src_type == "official" or any(a in low for a in ATTRIB_KW)
    if attributed and any(k in low for k in PRESSER_KW):
        return "Press Conference"
    if attributed and any(k in low for k in SPEECH_KW):
        return "Speech"
    if src_type == "official":
        return "Official"
    return "News"


def get_quote(ticker: str) -> dict | None:
    try:
        import yfinance as yf
        h = yf.Ticker(ticker).history(period="1mo")
        if h.empty:
            return None
        # zip dates+closes and drop NaN rows (c == c is False for NaN) so a single
        # bad close can't leak the literal token `NaN` into data.json and break JSON.parse
        rows = [(d.strftime("%m-%d"), round(float(c), 2))
                for d, c in zip(h.index, h["Close"].tolist()) if c == c]
        rows = rows[-22:]
        if len(rows) < 2:
            return None
        dates  = [r[0] for r in rows]
        closes = [r[1] for r in rows]
        cur, prev = closes[-1], closes[-2]
        day = round((cur - prev) / prev * 100, 2) if prev else 0.0
        series = [{"d": dt, "c": c} for dt, c in zip(dates, closes)]
        return {"price": cur, "day_change_pct": day, "series": series}
    except Exception:
        return None


def fmt_date(pub: str) -> str:
    try:
        import email.utils
        return email.utils.parsedate_to_datetime(pub).strftime("%b %d, %Y")
    except Exception:
        return pub[:10] if pub else "Recent"


def run():
    print(f"[{datetime.now():%H:%M:%S}] TrumpSays CI pipeline starting")
    articles = fetch_articles()
    print(f"Fetched {len(articles)} articles")

    results, seen_ids = [], set()
    quote_cache = {}

    for art in articles:
        companies = find_companies(art["title"] + " " + art["body"])
        for c in companies:
            uid = f"{art['link'][-20:]}::{c['company'][:10].lower()}"
            if uid in seen_ids:
                continue
            seen_ids.add(uid)

            ticker = c.get("ticker")
            if ticker and ticker not in quote_cache:
                print(f"  Fetching {ticker}…")
                quote_cache[ticker] = get_quote(ticker)
                time.sleep(0.3)  # be gentle with Yahoo Finance

            quote = quote_cache.get(ticker) if ticker else None
            change = quote["day_change_pct"] if quote else None
            direction = (
                "up"   if change is not None and change >  0.3 else
                "down" if change is not None and change < -0.3 else
                "flat"
            )

            results.append({
                "id":           uid,
                "date":         art["pub"][:16],
                "date_display": fmt_date(art["pub"]),
                "source":       art["source"],
                "type":         art["type"],
                "quote":        c["snippet"],
                "company":      c["company"],
                "ticker":       ticker or "",
                "price":        quote["price"] if quote else None,
                "change":       change,
                "direction":    direction,
                "article_link": art["link"],
                "image":        art.get("image"),
                "headline":     art["title"],
                "channel":      classify_channel(art["source"], art["type"],
                                                  art["title"] + " " + art["body"]),
                "series":       quote.get("series") if quote else None,
            })

    results.sort(key=lambda x: x["date"], reverse=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count":      len(results),
        "mentions":   results,
    }
    # allow_nan=False fails loudly in CI rather than shipping invalid JSON (bare NaN/Infinity)
    OUT.write_text(json.dumps(payload, indent=2, default=str, allow_nan=False))
    print(f"Saved {len(results)} mentions → {OUT}")


if __name__ == "__main__":
    run()
