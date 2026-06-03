"""
TrumpSays – Dashboard Builder
Generates a self-contained HTML dashboard from enriched statement data.
"""

from datetime import datetime

SIGNAL_COLOR = {
    "BUY":   ("#22c55e", "#dcfce7"),
    "SELL":  ("#ef4444", "#fee2e2"),
    "WATCH": ("#f59e0b", "#fef9c3"),
    "AVOID": ("#7c3aed", "#ede9fe"),
}

SENTIMENT_BADGE = {
    "bullish": ("🟢", "#22c55e"),
    "bearish": ("🔴", "#ef4444"),
    "neutral": ("⚪", "#6b7280"),
    "mixed":   ("🟡", "#f59e0b"),
}


def _signal_card(mention: dict, statement_title: str, statement_link: str) -> str:
    sig = mention.get("signal", "WATCH")
    text_color, bg_color = SIGNAL_COLOR.get(sig, ("#6b7280", "#f3f4f6"))
    name = mention.get("name", "Unknown")
    ticker = mention.get("ticker") or ""
    reasoning = mention.get("reasoning", "")
    horizon = mention.get("time_horizon", "")
    strength = mention.get("signal_strength", 1)
    sentiment = mention.get("sentiment", "neutral")
    sent_emoji, sent_color = SENTIMENT_BADGE.get(sentiment, ("⚪", "#6b7280"))
    quote = mention.get("quote") or {}

    price_html = ""
    if quote.get("price"):
        day = quote.get("day_change_pct", 0)
        day_color = "#22c55e" if day >= 0 else "#ef4444"
        day_sign = "+" if day >= 0 else ""
        price_html = f"""
        <div class="quote">
          <span class="price">${quote['price']}</span>
          <span class="change" style="color:{day_color};">{day_sign}{day:.1f}% today</span>
        </div>"""

    strength_dots = "●" * strength + "○" * (5 - strength)

    return f"""
    <div class="card" data-signal="{sig}" data-sentiment="{sentiment}">
      <div class="card-header" style="background:{bg_color};border-left:4px solid {text_color};">
        <div class="signal-badge" style="color:{text_color};">{sig}</div>
        <div class="company-name">{name}
          {"<span class='ticker'>" + ticker + "</span>" if ticker else ""}
        </div>
        {price_html}
      </div>
      <div class="card-body">
        <p class="reasoning">{reasoning}</p>
        <div class="meta">
          <span class="sentiment" style="color:{sent_color};">{sent_emoji} {sentiment}</span>
          <span class="strength" title="Signal strength">{strength_dots}</span>
          {f'<span class="horizon">⏱ {horizon}-term</span>' if horizon else ""}
        </div>
        <div class="source">
          📰 <a href="{statement_link}" target="_blank">{statement_title[:90]}{"…" if len(statement_title)>90 else ""}</a>
        </div>
      </div>
    </div>"""


def _statement_row(stmt: dict) -> str:
    analysis = stmt.get("analysis", {})
    mentions = analysis.get("mentions", [])
    if not mentions:
        return ""

    title = stmt.get("title", "Untitled")
    link = stmt.get("link", "#")
    pub = stmt.get("published", "")[:16]
    summary = analysis.get("statement_summary", "")
    theme = analysis.get("macro_theme", "")
    regions = ", ".join(analysis.get("affected_regions", []))

    cards = "".join(_signal_card(m, title, link) for m in mentions)

    return f"""
    <section class="statement-block">
      <div class="statement-header">
        <div class="statement-meta">
          {f'<span class="theme-tag">{theme}</span>' if theme else ""}
          {f'<span class="region-tag">🌍 {regions}</span>' if regions else ""}
          {f'<span class="date-tag">🕐 {pub}</span>' if pub else ""}
        </div>
        <h3 class="statement-title">
          <a href="{link}" target="_blank">{title}</a>
        </h3>
        {f'<p class="statement-summary">{summary}</p>' if summary else ""}
      </div>
      <div class="cards-grid">{cards}</div>
    </section>"""


def build_dashboard(enriched: list[dict]) -> str:
    now = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    total_signals = sum(len(s.get("analysis", {}).get("mentions", [])) for s in enriched)
    statement_sections = "".join(_statement_row(s) for s in enriched)

    if not statement_sections.strip():
        statement_sections = """
        <div class="empty-state">
          <p>🔍 No actionable signals found. Try running again later or adding more news sources.</p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🇺🇸 TrumpSays – Market Signals</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f1f5f9;
    color: #1e293b;
    min-height: 100vh;
  }}

  /* Header */
  .header {{
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
    color: white;
    padding: 24px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }}
  .header-title {{ font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }}
  .header-sub {{ font-size: 13px; color: #93c5fd; margin-top: 2px; }}
  .header-stats {{
    display: flex; gap: 20px; align-items: center;
    flex-wrap: wrap;
  }}
  .stat-chip {{
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 13px;
    color: #e2e8f0;
  }}
  .stat-chip strong {{ color: white; }}

  /* Filters */
  .filter-bar {{
    background: white;
    padding: 12px 32px;
    border-bottom: 1px solid #e2e8f0;
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  }}
  .filter-label {{ font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px; }}
  .filter-btn {{
    border: 1px solid #e2e8f0;
    background: white;
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 13px;
    cursor: pointer;
    color: #374151;
    transition: all 0.15s;
  }}
  .filter-btn:hover, .filter-btn.active {{ background: #1e3a5f; color: white; border-color: #1e3a5f; }}

  /* Main content */
  .main {{ max-width: 1100px; margin: 0 auto; padding: 24px 16px; }}

  /* Statement blocks */
  .statement-block {{
    background: white;
    border-radius: 12px;
    margin-bottom: 24px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    overflow: hidden;
  }}
  .statement-header {{
    padding: 16px 20px;
    border-bottom: 1px solid #f1f5f9;
    background: #fafafa;
  }}
  .statement-meta {{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }}
  .theme-tag, .region-tag, .date-tag {{
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }}
  .theme-tag {{ background: #dbeafe; color: #1d4ed8; }}
  .region-tag {{ background: #d1fae5; color: #065f46; }}
  .date-tag {{ background: #f3f4f6; color: #4b5563; }}
  .statement-title {{ font-size: 15px; font-weight: 600; margin-bottom: 4px; }}
  .statement-title a {{ color: #1e293b; text-decoration: none; }}
  .statement-title a:hover {{ color: #1d4ed8; text-decoration: underline; }}
  .statement-summary {{ font-size: 13px; color: #64748b; margin-top: 4px; }}

  /* Cards grid */
  .cards-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1px;
    background: #e2e8f0;
  }}
  .card {{ background: white; }}
  .card-header {{
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }}
  .signal-badge {{
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    min-width: 44px;
  }}
  .company-name {{
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
  }}
  .ticker {{
    display: inline-block;
    background: #1e293b;
    color: white;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 6px;
    font-weight: 700;
    letter-spacing: 0.05em;
    vertical-align: middle;
  }}
  .quote {{ text-align: right; white-space: nowrap; }}
  .price {{ display: block; font-size: 15px; font-weight: 700; color: #0f172a; }}
  .change {{ font-size: 12px; font-weight: 600; }}
  .card-body {{ padding: 12px 16px 14px; }}
  .reasoning {{ font-size: 13px; color: #374151; line-height: 1.5; margin-bottom: 10px; }}
  .meta {{ display: flex; gap: 12px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }}
  .sentiment {{ font-size: 12px; font-weight: 600; text-transform: capitalize; }}
  .strength {{ font-size: 12px; color: #f59e0b; letter-spacing: 2px; }}
  .horizon {{ font-size: 11px; color: #6b7280; }}
  .source {{ font-size: 11px; color: #9ca3af; }}
  .source a {{ color: #6b7280; text-decoration: none; }}
  .source a:hover {{ text-decoration: underline; color: #1d4ed8; }}

  /* Empty state */
  .empty-state {{
    text-align: center; padding: 60px 20px; color: #9ca3af;
    font-size: 15px;
  }}

  /* Disclaimer */
  .disclaimer {{
    text-align: center;
    padding: 20px;
    font-size: 12px;
    color: #9ca3af;
    border-top: 1px solid #e2e8f0;
    margin-top: 8px;
  }}

  /* Responsive */
  @media (max-width: 600px) {{
    .header {{ padding: 16px; }}
    .main {{ padding: 16px 8px; }}
    .filter-bar {{ padding: 10px 16px; }}
  }}
</style>
</head>
<body>

<header class="header">
  <div>
    <div class="header-title">🇺🇸 TrumpSays Market Signals</div>
    <div class="header-sub">Updated: {now}</div>
  </div>
  <div class="header-stats">
    <div class="stat-chip"><strong>{len(enriched)}</strong> statements</div>
    <div class="stat-chip"><strong>{total_signals}</strong> signals</div>
  </div>
</header>

<div class="filter-bar">
  <span class="filter-label">Filter:</span>
  <button class="filter-btn active" onclick="filterCards('all')">All</button>
  <button class="filter-btn" onclick="filterCards('BUY')" style="color:#22c55e;">🟢 BUY</button>
  <button class="filter-btn" onclick="filterCards('SELL')" style="color:#ef4444;">🔴 SELL</button>
  <button class="filter-btn" onclick="filterCards('WATCH')" style="color:#f59e0b;">🟡 WATCH</button>
  <button class="filter-btn" onclick="filterCards('AVOID')" style="color:#7c3aed;">⛔ AVOID</button>
</div>

<main class="main">
  {statement_sections}
  <p class="disclaimer">
    ⚠️ TrumpSays is for informational purposes only. Not financial advice. Always conduct your own research before making investment decisions.
  </p>
</main>

<script>
function filterCards(signal) {{
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.statement-block').forEach(block => {{
    const cards = block.querySelectorAll('.card');
    let visibleCards = 0;
    cards.forEach(card => {{
      const show = signal === 'all' || card.dataset.signal === signal;
      card.style.display = show ? '' : 'none';
      if (show) visibleCards++;
    }});
    block.style.display = (signal === 'all' || visibleCards > 0) ? '' : 'none';
  }});
}}
</script>

</body>
</html>"""
