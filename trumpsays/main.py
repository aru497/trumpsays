"""
TrumpSays – Main Runner
Orchestrates fetch → analyze → enrich → output pipeline.

Usage:
    python -m trumpsays.main                    # run analysis, print summary
    python -m trumpsays.main --email            # also send digest email
    python -m trumpsays.main --dashboard        # write dashboard HTML and open browser
    python -m trumpsays.main --email --dashboard

Environment variables required:
    ANTHROPIC_API_KEY   – Claude API key (required)
    SMTP_USER           – Gmail/SMTP username (for email)
    SMTP_PASS           – Gmail app password (for email)
    DIGEST_EMAIL        – recipient email (default: aru497@gmail.com)
"""

import argparse
import json
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

from .fetcher import fetch_statements
from .analyzer import analyze_batch
from .market_data import enrich_with_quotes
from .emailer import send_digest
from .dashboard import build_dashboard


DIGEST_EMAIL = os.environ.get("DIGEST_EMAIL", "aru497@gmail.com")
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def run_pipeline(max_statements: int = 20) -> list[dict]:
    print("\n🇺🇸 TrumpSays – Running pipeline\n" + "=" * 50)

    print("\n[1/3] Fetching Trump statements...")
    statements = fetch_statements(max_per_feed=10)
    print(f"      → {len(statements)} statements fetched")

    if not statements:
        print("No statements found. Check your internet connection.")
        return []

    print(f"\n[2/3] Analyzing with Claude (up to {max_statements})...")
    enriched = analyze_batch(statements, max_items=max_statements)

    print("\n[3/3] Fetching live market quotes...")
    enriched = enrich_with_quotes(enriched)

    return enriched


def print_summary(enriched: list[dict]) -> None:
    print("\n" + "=" * 50)
    print("📊 INVESTMENT SIGNALS\n")
    signal_count = 0
    for stmt in enriched:
        analysis = stmt.get("analysis", {})
        mentions = analysis.get("mentions", [])
        if not mentions:
            continue
        print(f"📰 {stmt['title'][:90]}")
        for m in mentions:
            sig = m.get("signal", "?")
            icon = {"BUY": "🟢", "SELL": "🔴", "WATCH": "🟡", "AVOID": "⛔"}.get(sig, "•")
            ticker = f"({m['ticker']})" if m.get("ticker") else ""
            quote = m.get("quote") or {}
            price = f" | ${quote['price']} ({quote.get('day_change_pct',0):+.1f}% today)" if quote.get("price") else ""
            print(f"  {icon} {sig:5s} {m['name']} {ticker}{price}")
            print(f"       {m.get('reasoning','')[:100]}")
            signal_count += 1
        print()
    print(f"Total signals: {signal_count}")


def save_json(enriched: list[dict]) -> Path:
    path = OUTPUT_DIR / "latest.json"
    with open(path, "w") as f:
        json.dump(enriched, f, indent=2, default=str)
    print(f"\nData saved → {path}")
    return path


def main():
    parser = argparse.ArgumentParser(description="TrumpSays Market Signal Pipeline")
    parser.add_argument("--email", action="store_true", help="Send digest email")
    parser.add_argument("--dashboard", action="store_true", help="Build and open dashboard")
    parser.add_argument("--max", type=int, default=20, help="Max statements to analyze")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY environment variable not set.")
        sys.exit(1)

    enriched = run_pipeline(max_statements=args.max)
    if not enriched:
        sys.exit(0)

    print_summary(enriched)
    save_json(enriched)

    if args.dashboard:
        html_path = OUTPUT_DIR / "dashboard.html"
        html = build_dashboard(enriched)
        with open(html_path, "w") as f:
            f.write(html)
        print(f"Dashboard saved → {html_path}")
        webbrowser.open(f"file://{html_path.resolve()}")

    if args.email:
        print(f"\nSending digest to {DIGEST_EMAIL}...")
        send_digest(enriched, to_email=DIGEST_EMAIL)


if __name__ == "__main__":
    main()
