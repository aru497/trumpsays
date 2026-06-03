"""
TrumpSays – Market Data
Fetches real-time stock/ETF prices and performance for mentioned tickers.
"""

import yfinance as yf
from typing import Optional


def get_quote(ticker: str) -> Optional[dict]:
    """
    Fetch current price and recent performance for a ticker.
    Returns None if ticker is invalid or data unavailable.
    """
    if not ticker or ticker.lower() in ("null", "none", "n/a"):
        return None
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="5d")
        if hist.empty:
            return None

        current = float(hist["Close"].iloc[-1])
        prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
        week_open = float(hist["Open"].iloc[0])

        day_pct = ((current - prev_close) / prev_close) * 100
        week_pct = ((current - week_open) / week_open) * 100

        info = {}
        try:
            info = t.fast_info
            mkt_cap = getattr(info, "market_cap", None)
        except Exception:
            mkt_cap = None

        return {
            "ticker": ticker.upper(),
            "price": round(current, 2),
            "day_change_pct": round(day_pct, 2),
            "week_change_pct": round(week_pct, 2),
            "market_cap": mkt_cap,
            "currency": "USD",
        }
    except Exception as e:
        return {"ticker": ticker.upper(), "error": str(e)}


def enrich_with_quotes(enriched_statements: list[dict]) -> list[dict]:
    """
    Add live market quotes to each mention that has a ticker.
    Modifies in place and returns the list.
    """
    seen_tickers = {}  # cache to avoid repeat API calls

    for stmt in enriched_statements:
        analysis = stmt.get("analysis", {})
        for mention in analysis.get("mentions", []):
            ticker = mention.get("ticker")
            if ticker and ticker not in seen_tickers:
                print(f"  Fetching quote: {ticker}")
                seen_tickers[ticker] = get_quote(ticker)
            if ticker:
                mention["quote"] = seen_tickers.get(ticker)

    return enriched_statements


if __name__ == "__main__":
    import json
    tickers = ["AAPL", "TSLA", "FXI", "GLD", "NVDA"]
    for t in tickers:
        print(json.dumps(get_quote(t), indent=2))
        print()
