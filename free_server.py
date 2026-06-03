"""
TrumpSays – 100% Free Server
No API keys. No paid services. Runs entirely offline after install.

Sources:
  - whitehouse.gov/briefing-room (official press releases & transcripts)
  - truthsocial.com/@realDonaldTrump.rss (public RSS)
  - Google News RSS (fallback)

Company extraction:
  - spaCy en_core_web_sm (local NER model, free)
  - S&P 500 + common company → ticker lookup table

Market data:
  - yfinance (free, no key)

Setup:
  pip install feedparser yfinance spacy requests
  python -m spacy download en_core_web_sm
  python free_server.py
  Open: http://localhost:8080
"""

import json
import re
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# S&P 500 + Major company → ticker map
# (covers the companies Trump mentions most)
# ─────────────────────────────────────────────────────────────────────────────
COMPANY_TICKERS = {
    # Tech
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL", "alphabet": "GOOGL",
    "amazon": "AMZN", "meta": "META", "facebook": "META", "nvidia": "NVDA",
    "tesla": "TSLA", "netflix": "NFLX", "intel": "INTC", "amd": "AMD",
    "qualcomm": "QCOM", "ibm": "IBM", "oracle": "ORCL", "salesforce": "CRM",
    "adobe": "ADBE", "zoom": "ZM", "twitter": "X", "x corp": "X",
    "openai": None, "tiktok": None, "bytedance": None,
    # Finance
    "jpmorgan": "JPM", "jp morgan": "JPM", "goldman sachs": "GS",
    "bank of america": "BAC", "wells fargo": "WFC", "morgan stanley": "MS",
    "citigroup": "C", "citi": "C", "blackrock": "BLK", "berkshire": "BRK-B",
    "visa": "V", "mastercard": "MA", "american express": "AXP",
    # Energy
    "exxon": "XOM", "exxonmobil": "XOM", "chevron": "CVX",
    "conocophillips": "COP", "schlumberger": "SLB", "halliburton": "HAL",
    "bp": "BP", "shell": "SHEL",
    # Defense
    "lockheed": "LMT", "lockheed martin": "LMT", "raytheon": "RTX",
    "boeing": "BA", "northrop": "NOC", "northrop grumman": "NOC",
    "general dynamics": "GD", "l3harris": "LHX",
    # Retail / Consumer
    "walmart": "WMT", "target": "TGT", "costco": "COST",
    "home depot": "HD", "lowe's": "LOW", "lowes": "LOW",
    "mcdonald's": "MCD", "mcdonalds": "MCD", "starbucks": "SBUX",
    "coca-cola": "KO", "coca cola": "KO", "coke": "KO",
    "pepsi": "PEP", "pepsico": "PEP", "nike": "NKE",
    # Auto
    "ford": "F", "general motors": "GM", "gm": "GM", "stellantis": "STLA",
    # Pharma / Health
    "pfizer": "PFE", "johnson & johnson": "JNJ", "johnson and johnson": "JNJ",
    "unitedhealth": "UNH", "cvs": "CVS", "moderna": "MRNA",
    "eli lilly": "LLY", "merck": "MRK", "abbvie": "ABBV",
    # Media / Telecom
    "disney": "DIS", "comcast": "CMCSA", "at&t": "T", "att": "T",
    "verizon": "VZ", "fox": "FOX", "fox news": "FOX", "cnn": None,
    "new york times": "NYT", "nyt": "NYT",
    # Industrial
    "caterpillar": "CAT", "deere": "DE", "john deere": "DE",
    "3m": "MMM", "honeywell": "HON", "ge": "GE", "general electric": "GE",
    "ups": "UPS", "fedex": "FDX",
    # Crypto / Fintech
    "coinbase": "COIN", "robinhood": "HOOD", "paypal": "PYPL",
    # Airlines
    "delta": "DAL", "united airlines": "UAL", "american airlines": "AAL",
    "southwest": "LUV",
    # China-related (Trump mentions often)
    "huawei": None, "tencent": "TCEHY", "alibaba": "BABA",
    "bytedance": None, "xiaomi": "XIACY",
}

# ─────────────────────────────────────────────────────────────────────────────
# RSS Sources (all free, no auth)
# ─────────────────────────────────────────────────────────────────────────────
RSS_SOURCES = [
    {
        "name": "White House",
        "url": "https://www.whitehouse.gov/feed/",
        "type": "press_release",
    },
    {
        "name": "White House Briefing Room",
        "url": "https://www.whitehouse.gov/briefing-room/statements-releases/feed/",
        "type": "statement",
    },
    {
        "name": "Truth Social",
        "url": "https://truthsocial.com/@realDonaldTrump.rss",
        "type": "truth_social",
    },
    {
        "name": "Google News – Trump",
        "url": "https://news.google.com/rss/search?q=Trump+says+announces+company&hl=en-US&gl=US&ceid=US:en",
        "type": "news",
    },
    {
        "name": "Google News – Trump Trade",
        "url": "https://news.google.com/rss/search?q=Trump+tariff+company+stock&hl=en-US&gl=US&ceid=US:en",
        "type": "news",
    },
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TrumpSays/1.0; +https://trumpsays.info)"}
PORT          = 8080
POLL_INTERVAL = 900   # 15 min
DATA_FILE     = Path(__file__).parent / "output" / "free_live_data.json"
DATA_FILE.parent.mkdir(exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Fetcher
# ─────────────────────────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    import feedparser
    seen, results = set(), []

    for src in RSS_SOURCES:
        try:
            req = urllib.request.Request(src["url"], headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                raw = r.read()
            feed = feedparser.parse(raw)
            for e in feed.entries[:20]:
                title = e.get("title", "").strip()
                key = title[:60].lower()
                if not title or key in seen:
                    continue
                seen.add(key)
                summary = re.sub(r"<[^>]+>", "", e.get("summary", e.get("content", [{}])[0].get("value", "")) if e.get("content") else e.get("summary", ""))
                results.append({
                    "title":     title,
                    "body":      summary[:1000],
                    "link":      e.get("link", "#"),
                    "published": e.get("published", ""),
                    "source":    src["name"],
                    "type":      src["type"],
                })
            print(f"  ✓ {src['name']}: {len(feed.entries)} items")
        except Exception as ex:
            print(f"  ✗ {src['name']}: {ex}")

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Company Extractor (spaCy NER + ticker lookup)
# ─────────────────────────────────────────────────────────────────────────────
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("[warn] spaCy model not found. Run: python -m spacy download en_core_web_sm")
            _nlp = None
    return _nlp


def extract_companies(text: str) -> list[dict]:
    """Extract company mentions using spaCy NER + ticker lookup table."""
    results = []
    seen_companies = set()

    full_text = text.lower()

    # 1. Direct lookup in our ticker table (catches common names spaCy might miss)
    for name, ticker in COMPANY_TICKERS.items():
        # Use word-boundary matching
        pattern = r'\b' + re.escape(name) + r'\b'
        if re.search(pattern, full_text):
            key = name
            if key not in seen_companies:
                seen_companies.add(key)
                # Find the quote fragment around the mention
                match = re.search(pattern, full_text)
                start = max(0, match.start() - 40)
                end   = min(len(full_text), match.end() + 40)
                snippet = text[start:end].strip()
                results.append({
                    "company": name.title(),
                    "ticker":  ticker,
                    "snippet": snippet,
                    "method":  "lookup",
                })

    # 2. spaCy NER for anything not in the lookup table
    nlp = get_nlp()
    if nlp:
        doc = nlp(text[:5000])  # limit for speed
        for ent in doc.ents:
            if ent.label_ == "ORG":
                ent_lower = ent.text.lower().strip()
                # Skip if already found, or if it's clearly not a company
                if ent_lower in seen_companies or len(ent_lower) < 3:
                    continue
                # Try to match to a ticker
                ticker = COMPANY_TICKERS.get(ent_lower)
                if not ticker:
                    # Try partial match
                    for k, v in COMPANY_TICKERS.items():
                        if ent_lower in k or k in ent_lower:
                            ticker = v
                            break
                seen_companies.add(ent_lower)
                start  = max(0, ent.start_char - 40)
                end    = min(len(text), ent.end_char + 40)
                snippet = text[start:end].strip()
                results.append({
                    "company": ent.text.strip(),
                    "ticker":  ticker,
                    "snippet": snippet,
                    "method":  "spacy",
                })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Stock quotes (yfinance, free)
# ─────────────────────────────────────────────────────────────────────────────
_quote_cache: dict = {}
_cache_ts: dict    = {}
CACHE_TTL = 300  # 5 min


def get_quote(ticker: str) -> dict | None:
    if not ticker:
        return None
    now = time.time()
    if ticker in _quote_cache and (now - _cache_ts.get(ticker, 0)) < CACHE_TTL:
        return _quote_cache[ticker]
    try:
        import yfinance as yf
        hist = yf.Ticker(ticker).history(period="5d")
        if hist.empty:
            return None
        cur  = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else cur
        day  = round((cur - prev) / prev * 100, 2)
        result = {"ticker": ticker, "price": round(cur, 2), "day_change_pct": day}
        _quote_cache[ticker] = result
        _cache_ts[ticker]    = now
        return result
    except Exception as e:
        print(f"  [quote] {ticker}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline
# ─────────────────────────────────────────────────────────────────────────────
def fmt_date(pub: str) -> str:
    try:
        import email.utils
        dt = email.utils.parsedate_to_datetime(pub)
        return dt.strftime("%b %d, %Y")
    except Exception:
        return pub[:10] if len(pub) >= 10 else "Recent"


def run_pipeline():
    print(f"\n[{datetime.now():%H:%M:%S}] Pipeline running…")
    articles = fetch_all()
    print(f"  → {len(articles)} articles fetched")

    results = []
    seen_ids = set()

    for art in articles:
        full_text = art["title"] + " " + art["body"]
        companies = extract_companies(full_text)

        for c in companies:
            uid = f"{art['link'][-24:]}::{c['company'].lower()[:12]}"
            if uid in seen_ids:
                continue
            seen_ids.add(uid)

            ticker  = c.get("ticker")
            quote   = get_quote(ticker) if ticker else None
            change  = quote["day_change_pct"] if quote else None
            direction = (
                "up"   if change is not None and change >  0.3 else
                "down" if change is not None and change < -0.3 else
                "flat"
            )

            results.append({
                "id":            uid,
                "date":          art.get("published", "")[:16],
                "date_display":  fmt_date(art.get("published", "")),
                "source":        art["source"],
                "type":          art["type"],
                "quote":         c.get("snippet", ""),
                "company":       c["company"],
                "ticker":        ticker or "",
                "price":         quote["price"] if quote else None,
                "change":        change,
                "direction":     direction,
                "article_title": art["title"],
                "article_link":  art["link"],
            })

    results.sort(key=lambda x: x["date"], reverse=True)

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count":      len(results),
        "mentions":   results,
    }
    DATA_FILE.write_text(json.dumps(payload, indent=2, default=str))
    print(f"  → {len(results)} company mentions saved")
    return payload


def poll_loop():
    while True:
        try:
            run_pipeline()
        except Exception as e:
            print(f"[error] {e}")
        time.sleep(POLL_INTERVAL)


# ─────────────────────────────────────────────────────────────────────────────
# HTTP Server (stdlib, no Flask needed)
# ─────────────────────────────────────────────────────────────────────────────
DASHBOARD = Path(__file__).parent / "output" / "trumpsays_live.html"


def get_data() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return {"updated_at": None, "count": 0, "mentions": []}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence access logs

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            body = DASHBOARD.read_bytes() if DASHBOARD.exists() else b"<h1>Dashboard not found</h1>"
            self._respond(200, "text/html; charset=utf-8", body)
        elif self.path.startswith("/data.json"):
            body = json.dumps(get_data(), default=str).encode()
            self._respond(200, "application/json", body)
        else:
            self._respond(404, "text/plain", b"Not found")

    def _respond(self, code, ct, body):
        self.send_response(code)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🇺🇸 TrumpSays (free edition) starting…")
    print(f"   http://localhost:{PORT}")
    print(f"   Polling every {POLL_INTERVAL // 60} min\n")

    # First run
    try:
        run_pipeline()
    except Exception as e:
        print(f"[warn] First run: {e}")

    # Background polling
    threading.Thread(target=poll_loop, daemon=True).start()

    # Open browser
    try:
        import webbrowser
        webbrowser.open(f"http://localhost:{PORT}")
    except Exception:
        pass

    HTTPServer(("", PORT), Handler).serve_forever()
