"""
TrumpSays – Email Digest
Sends a formatted HTML digest email using SendGrid or SMTP.
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime


SIGNAL_EMOJI = {
    "BUY": "🟢",
    "SELL": "🔴",
    "WATCH": "🟡",
    "AVOID": "⛔",
}

SENTIMENT_COLOR = {
    "bullish": "#22c55e",
    "bearish": "#ef4444",
    "neutral": "#6b7280",
    "mixed": "#f59e0b",
}


def build_html_digest(enriched_statements: list[dict]) -> str:
    """Build an HTML email body from enriched statements."""

    # Collect all unique mentions with signals
    all_signals = []
    for stmt in enriched_statements:
        analysis = stmt.get("analysis", {})
        summary = analysis.get("statement_summary", stmt.get("title", ""))
        date = stmt.get("published", "")[:16]
        for mention in analysis.get("mentions", []):
            if mention.get("signal") in ("BUY", "SELL", "WATCH", "AVOID"):
                all_signals.append({
                    "statement": summary,
                    "date": date,
                    "link": stmt.get("link", "#"),
                    **mention,
                })

    if not all_signals:
        return "<p>No actionable signals today.</p>"

    rows = ""
    for s in all_signals:
        sig = s.get("signal", "WATCH")
        emoji = SIGNAL_EMOJI.get(sig, "•")
        ticker = s.get("ticker") or "—"
        color = SENTIMENT_COLOR.get(s.get("sentiment", "neutral"), "#6b7280")
        quote = s.get("quote") or {}
        price_str = f"${quote.get('price', '—')}" if quote.get("price") else "—"
        day_str = f"{quote.get('day_change_pct', '—')}%" if quote.get("day_change_pct") is not None else "—"
        day_color = "#22c55e" if str(day_str).startswith("-") is False and day_str != "—" else "#ef4444"

        rows += f"""
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;">
            <strong style="color:{color};">{emoji} {s.get('name','')}</strong>
            <span style="font-size:11px;color:#6b7280;margin-left:8px;">{ticker}</span><br/>
            <span style="font-size:12px;color:#374151;">{s.get('reasoning','')}</span><br/>
            <span style="font-size:11px;color:#9ca3af;">Via: <a href="{s.get('link','#')}">{s.get('statement','')[:80]}...</a></span>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap;">
            <strong>{sig}</strong>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">
            {price_str}<br/>
            <span style="color:{day_color};font-size:12px;">{day_str} today</span>
          </td>
        </tr>
        """

    date_str = datetime.now().strftime("%B %d, %Y")
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>TrumpSays Daily Digest</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;color:#111827;">
      <div style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:white;font-size:22px;">🇺🇸 TrumpSays Market Signals</h1>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:14px;">{date_str} Daily Digest</p>
      </div>
      <div style="background:#f9fafb;padding:24px 32px;">
        <p style="color:#374151;margin-top:0;">
          <strong>{len(all_signals)} actionable signal{"s" if len(all_signals)!=1 else ""}</strong> from {len(enriched_statements)} Trump statements today.
        </p>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Company / Reasoning</th>
              <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Signal</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;">Price</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <div style="padding:16px 32px;background:#f3f4f6;border-radius:0 0 8px 8px;font-size:11px;color:#9ca3af;">
        ⚠️ TrumpSays is for informational purposes only. Not financial advice. Always do your own research.
      </div>
    </body>
    </html>
    """
    return html


def send_email_smtp(
    to_email: str,
    subject: str,
    html_body: str,
    smtp_host: str = None,
    smtp_port: int = 587,
    smtp_user: str = None,
    smtp_pass: str = None,
) -> bool:
    """
    Send HTML email via SMTP (Gmail, Outlook, etc).
    Set env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    """
    smtp_host = smtp_host or os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = smtp_port or int(os.environ.get("SMTP_PORT", 587))
    smtp_user = smtp_user or os.environ.get("SMTP_USER", "")
    smtp_pass = smtp_pass or os.environ.get("SMTP_PASS", "")

    if not smtp_user or not smtp_pass:
        print("[emailer] SMTP_USER / SMTP_PASS not set — skipping send.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        print(f"[emailer] Digest sent to {to_email}")
        return True
    except Exception as e:
        print(f"[emailer] Send failed: {e}")
        return False


def send_digest(enriched_statements: list[dict], to_email: str) -> bool:
    """Build and send the daily digest email."""
    html = build_html_digest(enriched_statements)
    date_str = datetime.now().strftime("%b %d, %Y")
    return send_email_smtp(
        to_email=to_email,
        subject=f"🇺🇸 TrumpSays Market Signals – {date_str}",
        html_body=html,
    )
