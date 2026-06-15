"""
TrumpSays – CI Pipeline
Runs in GitHub Actions every 30 minutes.
No spaCy needed — uses lookup table only (fast, no model download).
Writes docs/data.json which GitHub Pages serves.
"""

import email.utils
import hashlib
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Accumulation window: keep a rolling archive, not just the latest snapshot ──
WINDOW_DAYS = 90
MAX_MENTIONS = 400

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
    # Trump-adjacent
    "trump media": "DJT", "truth social": "DJT", "djt": "DJT",
    # More tech / semis
    "broadcom": "AVGO", "cisco": "CSCO", "texas instruments": "TXN", "micron": "MU",
    "dell": "DELL", "hp": "HPQ", "hewlett packard": "HPE", "super micro": "SMCI",
    "supermicro": "SMCI", "arm": "ARM", "snap": "SNAP", "snapchat": "SNAP",
    "reddit": "RDDT", "roblox": "RBLX", "block": "SQ", "square": "SQ",
    # More finance / crypto
    "charles schwab": "SCHW", "schwab": "SCHW", "pnc": "PNC", "us bancorp": "USB",
    "truist": "TFC", "capital one": "COF", "microstrategy": "MSTR", "strategy": "MSTR",
    "marathon digital": "MARA", "riot": "RIOT", "block inc": "SQ",
    # More energy
    "occidental": "OXY", "devon energy": "DVN", "phillips 66": "PSX", "valero": "VLO",
    "kinder morgan": "KMI", "williams": "WMB", "schlumberger": "SLB",
    # More pharma / health
    "bristol myers": "BMY", "bristol-myers": "BMY", "gilead": "GILD", "biogen": "BIIB",
    "regeneron": "REGN", "vertex": "VRTX", "novavax": "NVAX", "humana": "HUM",
    # More consumer / retail / food
    "best buy": "BBY", "macy's": "M", "macys": "M", "kohl's": "KSS", "nordstrom": "JWN",
    "kraft heinz": "KHC", "general mills": "GIS", "kellogg": "K", "tyson": "TSN",
    "mondelez": "MDLZ", "hershey": "HSY", "kroger": "KR", "chipotle": "CMG",
    "lululemon": "LULU", "under armour": "UAA", "ralph lauren": "RL", "estee lauder": "EL",
    # More media / telecom
    "paramount": "PARA", "roku": "ROKU", "t-mobile": "TMUS", "tmobile": "TMUS",
    "charter": "CHTR", "snap inc": "SNAP",
    # More industrial / auto / airlines
    "cummins": "CMI", "emerson": "EMR", "illinois tool": "ITW", "parker hannifin": "PH",
    "whirlpool": "WHR", "jetblue": "JBLU", "alaska airlines": "ALK", "carnival": "CCL",
    "norwegian cruise": "NCLH", "royal caribbean": "RCL", "harley": "HOG",
    "harley-davidson": "HOG", "caterpillar inc": "CAT",
}

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TrumpSays/1.0)"}

GN = "https://news.google.com/rss/search?q={}&hl=en-US&gl=US&ceid=US:en"
RSS_FEEDS = [
    # High-yield: Google News searches targeting Trump + companies / markets.
    # These return many recent matching articles, so they double as a backfill.
    ("Google News", GN.format("Trump+says+OR+announces+company"),                 "news"),
    ("Google News", GN.format("Trump+company+stock+OR+shares+OR+tariff"),         "news"),
    ("Google News", GN.format("Trump+press+conference+OR+speech+company+stock"),  "news"),
    ("Google News", GN.format("Trump+Truth+Social+company+OR+CEO"),               "news"),
    ("Google News", GN.format("Trump+praises+OR+attacks+company"),                "news"),
    # Venue-specific feeds (so the channel filter has Truth Social / Official items)
    ("Truth Social", "https://truthsocial.com/@realDonaldTrump.rss",              "social"),
    ("White House",  "https://www.whitehouse.gov/feed/",                          "official"),
    # Best-effort general feeds
    ("PBS NewsHour", "https://www.pbs.org/newshour/feeds/rss/politics",           "news"),
    ("NPR Politics", "https://feeds.npr.org/1014/rss.xml",                        "news"),
]


def iso_ts(pub: str) -> str:
    """Parse an RSS published string to a UTC ISO timestamp (now if unparseable)."""
    try:
        return email.utils.parsedate_to_datetime(pub).astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


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
            for e in feed.entries[:40]:
                t = re.sub(r"<[^>]+>", "", e.get("title", "")).strip()
                k = t[:60].lower()
                if not t or k in seen:
                    continue
                seen.add(k)
                body = re.sub(r"<[^>]+>", "",
                    e.get("summary", "") or
                    (e.get("content") or [{}])[0].get("value", ""))
                # Google News items carry the real publisher in <source>
                try:
                    publisher = (e.get("source") or {}).get("title")
                except Exception:
                    publisher = None
                out.append({
                    "title":   t,
                    "body":    body[:800],
                    "link":    e.get("link", "#"),
                    "pub":     e.get("published", ""),
                    "ts":      iso_ts(e.get("published", "")),
                    "source":  publisher or name,
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


def load_existing() -> dict:
    """Load the prior data.json so we ACCUMULATE history instead of overwriting it."""
    try:
        data = json.loads(OUT.read_text())
        return {m["id"]: m for m in data.get("mentions", []) if m.get("id")}
    except Exception:
        return {}


def mk_id(company: str, ticker: str, title: str) -> str:
    """Stable id for a (company, article) pair so the same mention dedupes across runs."""
    base = f"{(ticker or company or '').lower()}|{(title or '')[:80].lower()}"
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def within_window(m: dict, cutoff_ts: float) -> bool:
    ts = m.get("ts")
    if not ts:
        return True  # keep undated legacy rows
    try:
        return datetime.fromisoformat(ts).timestamp() >= cutoff_ts
    except Exception:
        return True


def run():
    print(f"[{datetime.now():%H:%M:%S}] TrumpSays CI pipeline starting")
    archive = load_existing()                 # id -> mention  (rolling history)
    print(f"Loaded {len(archive)} existing mentions")
    articles = fetch_articles()
    print(f"Fetched {len(articles)} articles")

    quote_cache = {}
    new_count = 0

    for art in articles:
        companies = find_companies(art["title"] + " " + art["body"])
        for c in companies:
            uid = mk_id(c["company"], c.get("ticker"), art["title"])
            if uid in archive:
                continue  # already recorded — keep its original snapshot (price at the time)

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

            archive[uid] = {
                "id":           uid,
                "date":         art["pub"][:16],
                "ts":           art.get("ts"),
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
            }
            new_count += 1

    print(f"Added {new_count} new mentions")

    # Prune to a rolling window + hard cap, newest first.
    cutoff = datetime.now(timezone.utc).timestamp() - WINDOW_DAYS * 86400
    merged = sorted(archive.values(), key=lambda m: m.get("ts") or "", reverse=True)
    merged = [m for m in merged if within_window(m, cutoff)][:MAX_MENTIONS]

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count":      len(merged),
        "mentions":   merged,
    }
    # allow_nan=False fails loudly in CI rather than shipping invalid JSON (bare NaN/Infinity)
    OUT.write_text(json.dumps(payload, indent=2, default=str, allow_nan=False))
    print(f"Saved {len(merged)} mentions → {OUT}  (+{new_count} new this run)")


if __name__ == "__main__":
    run()
