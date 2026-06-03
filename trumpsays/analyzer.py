"""
TrumpSays – AI Analyzer
Uses Claude to extract company mentions and generate investment signals.
"""

import json
import os
from anthropic import Anthropic

client = Anthropic()  # uses ANTHROPIC_API_KEY from environment

SYSTEM_PROMPT = """You are a financial analyst specializing in political risk and market impact.

When given a news headline/article about Trump's statements, you:
1. Extract every company, stock, ETF, sector, or country market explicitly OR implicitly mentioned
2. Determine the sentiment (positive/negative/neutral/mixed) and directional signal
3. Explain the investment implication concisely
4. Rate signal strength (1–5, where 5 = very strong market-moving statement)

Return ONLY valid JSON in this exact schema:
{
  "statement_summary": "one-sentence summary of what Trump said",
  "mentions": [
    {
      "name": "Company or ETF name",
      "ticker": "TICKER or null if unknown",
      "type": "stock|etf|sector|country_market|currency|commodity",
      "sentiment": "bullish|bearish|neutral|mixed",
      "signal": "BUY|SELL|WATCH|AVOID",
      "signal_strength": 1,
      "reasoning": "why this signal, in 1–2 sentences",
      "time_horizon": "short|medium|long"
    }
  ],
  "macro_theme": "one of: tariffs|trade_deal|sanctions|deregulation|energy|defense|tech|finance|other",
  "affected_regions": ["US", "China", "EU", ...]
}

If there are no company/market mentions at all, return {"mentions": [], "statement_summary": "...", "macro_theme": "other", "affected_regions": []}.
"""


def analyze_statement(title: str, summary: str = "") -> dict:
    """
    Analyze a single Trump statement for investment signals.
    Returns parsed JSON dict.
    """
    content = f"Headline: {title}\n\nContext: {summary[:800]}" if summary else f"Headline: {title}"

    try:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "mentions": [], "statement_summary": title}
    except Exception as e:
        return {"error": str(e), "mentions": [], "statement_summary": title}


def analyze_batch(statements: list[dict], max_items: int = 20) -> list[dict]:
    """
    Analyze a list of statement dicts (from fetcher.py).
    Adds 'analysis' key to each. Returns enriched list.
    """
    enriched = []
    for stmt in statements[:max_items]:
        print(f"  Analyzing: {stmt['title'][:70]}...")
        result = analyze_statement(stmt["title"], stmt.get("summary", ""))
        enriched.append({**stmt, "analysis": result})
    return enriched


if __name__ == "__main__":
    # Quick test
    test = "Trump threatens 50% tariffs on Apple if they don't manufacture in the US"
    result = analyze_statement(test)
    print(json.dumps(result, indent=2))
