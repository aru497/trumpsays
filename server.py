"""
TrumpSays – Live Server
Run: python server.py
Open: http://localhost:8080

Polls news every 15 minutes, extracts company mentions via Claude,
fetches live stock prices, serves the dashboard and /data.json.

Requirements:
  pip install flask anthropic feedparser yfinance requests
  export ANTHROPIC_API_KEY="sk-ant-..."
"""

import json
import os
import re
import sys
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# ── optional: use Flask if available, else stdlib HTTPServer ──────────────────
try:
    from flask import Flask, jsonify, send_from_directory
    USE_FLASK = True
except ImportError:
    USE_FLASK = False

from anthropic import Anthropic

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
PORT          = int(os.environ.get("PORT", 8080))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", 900))  # 15 min
DATA_FILE     = Path(__file__).parent / "output" / "live_data.json"
DATA_FILE.parent.mkdir(exist_ok=True)

RSS_FEEDS = [
    "https://news.google.com/rss/search?q=Trump+says+company&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Trump+tariff+trade+deal+stock&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Trump+speech+press+conference+announces&hl=en-US&gl=US&ceid=US:en",
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TrumpSays/1.0)"}

client = Anthropic()

# ─────────────────────────────────────────────────────────────────────────────
# Fetcher
# ─────────────────────────────────────────────────────────────────────────────
def fetch_feeds() -> list[dict]:
    try:
        import feedparser
    except ImportError:
        print("[warn] feedparser not installed — pip install feedparser")
        return []

    seen, results = set(), []
    for url in RSS_FEEDS:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                data = r.read()
            feed = feedparser.parse(data)
            for e in feed.entries[:15]:
                key = e.get("title", "")[:60].lower()
                if key and key not in seen:
                    seen.add(key)
                    results.append({
                        "title":     e.get("title", ""),
                        "summary":   re.sub(r"<[^>]+>", "", e.get("summary", "")),
                        "link":      e.get("link", "#"),
                        "published": e.get("published", ""),
                        "source":    feed.feed.get("title", "News"),
                    })
        except Exception as ex:
            print(f"[warn] Feed failed: {ex}")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Analyzer (Claude)
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM = """You are a financial analyst. Given a news headline about Trump, extract ONLY companies or stocks he directly mentions by name (not inferred).

Return JSON only:
{
  "mentions": [
    {
      "company": "Full company name",
      "ticker": "TICKER or null",
      "quote_fragment": "exact words Trump used about this company (max 15 words)",
      "sentiment": "positive|negative|neutral",
      "source_type": "speech|press_conference|truth_social|interview|tweet|other"
    }
  ]
}

If no company is directly named, return {"mentions": []}.
Be strict — only direct name mentions, not implied ones."""


def analyze(title: str, summary: str = "") -> list[dict]:
    content = f"Headline: {title}\nContext: {summary[:400]}"
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=SYSTEM,
            messages=[{"role": "user", "content": content}],
        )
        raw = resp.content[0].text.strip().strip("```json").strip("```").strip()
        return json.loads(raw).get("mentions", [])
    except Exception as e:
        print(f"  [claude error] {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Stock quotes
# ─────────────────────────────────────────────────────────────────────────────
_quote_cache: dict[str, dict] = {}

def get_quote(ticker: str) -> dict | None:
    if not ticker:
        return None
    if ticker in _quote_cache:
        return _quote_cache[ticker]
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        hist = t.history(period="5d")
        if hist.empty:
            return None
        cur  = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else cur
        day  = round((cur - prev) / prev * 100, 2)
        result = {"ticker": ticker, "price": round(cur, 2), "day_change_pct": day}
        _quote_cache[ticker] = result
        return result
    except Exception as e:
        print(f"  [quote error] {ticker}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline
# ─────────────────────────────────────────────────────────────────────────────
def run_pipeline():
    print(f"\n[{datetime.now():%H:%M:%S}] Running pipeline...")
    articles = fetch_feeds()
    print(f"  Fetched {len(articles)} articles")

    results = []
    for art in articles[:25]:
        mentions = analyze(art["title"], art.get("summary", ""))
        if not mentions:
            continue
        for m in mentions:
            ticker  = m.get("ticker")
            quote   = get_quote(ticker) if ticker else None
            change  = quote["day_change_pct"] if quote else None
            direction = "up" if change and change > 0.3 else "down" if change and change < -0.3 else "flat"

            results.append({
                "id":           f"{art['link'][-20:]}-{m['company'][:8]}",
                "date":         art.get("published", "")[:16],
                "date_display": fmt_date(art.get("published", "")),
                "source":       m.get("source_type", "news").replace("_", " ").title(),
                "quote":        m.get("quote_fragment", ""),
                "company":      m.get("company", ""),
                "ticker":       ticker or "",
                "sentiment":    m.get("sentiment", "neutral"),
                "price":        quote["price"] if quote else None,
                "change":       change,
                "direction":    direction,
                "article_title": art["title"],
                "article_link":  art["link"],
            })

    # Sort newest first
    results.sort(key=lambda x: x["date"], reverse=True)

    # Save
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(results),
        "mentions": results,
    }
    DATA_FILE.write_text(json.dumps(payload, indent=2))
    print(f"  → {len(results)} mentions saved to {DATA_FILE}")
    return payload


def fmt_date(pub: str) -> str:
    try:
        import email.utils
        dt = email.utils.parsedate_to_datetime(pub)
        return dt.strftime("%b %d, %Y")
    except Exception:
        return pub[:10] if pub else "Recent"


def poll_loop():
    while True:
        try:
            run_pipeline()
        except Exception as e:
            print(f"[pipeline error] {e}")
        time.sleep(POLL_INTERVAL)


# ─────────────────────────────────────────────────────────────────────────────
# Server
# ─────────────────────────────────────────────────────────────────────────────
DASHBOARD_HTML = Path(__file__).parent / "output" / "trumpsays_live.html"


def get_data() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return {"updated_at": None, "count": 0, "mentions": []}


if USE_FLASK:
    app = Flask(__name__, static_folder=str(Path(__file__).parent / "output"))

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "trumpsays_live.html")

    @app.route("/data.json")
    def data():
        return jsonify(get_data())

    def run_server():
        app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)

else:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            if self.path in ("/", "/index.html"):
                body = DASHBOARD_HTML.read_bytes() if DASHBOARD_HTML.exists() else b"<p>Dashboard not found.</p>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/data.json":
                body = json.dumps(get_data()).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404); self.end_headers()

    def run_server():
        srv = HTTPServer(("", PORT), Handler)
        srv.serve_forever()


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: Set ANTHROPIC_API_KEY environment variable first.")
        sys.exit(1)

    print(f"🇺🇸 TrumpSays starting on http://localhost:{PORT}")
    print(f"   Polling every {POLL_INTERVAL // 60} minutes\n")

    # First run immediately
    try:
        run_pipeline()
    except Exception as e:
        print(f"[warn] First run failed: {e}")

    # Background polling
    t = threading.Thread(target=poll_loop, daemon=True)
    t.start()

    # Open browser
    try:
        import webbrowser
        webbrowser.open(f"http://localhost:{PORT}")
    except Exception:
        pass

    run_server()
