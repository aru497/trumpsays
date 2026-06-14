"use client";

import { Mention } from "@/lib/types";

interface SignalCardProps {
  mention: Mention;
  statementTitle: string;
  statementLink: string;
}

const SIGNAL_COLORS: Record<string, string> = {
  BUY: "var(--color-buy)",
  SELL: "var(--color-sell)",
  WATCH: "var(--color-watch)",
  AVOID: "var(--color-avoid)",
};

const SIGNAL_ICONS: Record<string, string> = {
  BUY: "🟢",
  SELL: "🔴",
  WATCH: "🟡",
  AVOID: "⛔",
};

const SENTIMENT_EMOJI: Record<string, string> = {
  bullish: "📈",
  bearish: "📉",
  neutral: "➡️",
  mixed: "⚡",
};

export function SignalCard({
  mention,
  statementTitle,
  statementLink,
}: SignalCardProps) {
  const signalColor = SIGNAL_COLORS[mention.signal] || "var(--color-accent-gold)";
  const directionColor = mention.quoteDayChange && mention.quoteDayChange > 0 ? "var(--color-buy)" : "var(--color-sell)";

  return (
    <div
      className="relative rounded border border-border transition-all duration-base hover:shadow-md hover:-translate-y-0.5 group"
      style={{
        borderColor: "var(--color-border)",
        borderLeft: `4px solid ${signalColor}`,
        backgroundColor: "var(--color-bg)",
      }}
    >
      {/* Header: Signal + Company */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{SIGNAL_ICONS[mention.signal]}</span>
              <span
                className="font-mono text-sm font-bold uppercase"
                style={{ color: signalColor }}
              >
                {mention.signal}
              </span>
              {mention.ticker && (
                <span
                  className="font-mono text-xs font-bold px-2 py-1 rounded"
                  style={{
                    background: "var(--color-bg-tertiary)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {mention.ticker}
                </span>
              )}
            </div>
            <h3
              className="font-sans text-lg font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {mention.name}
            </h3>
          </div>

          {/* Price (Right aligned) */}
          {mention.quotePrice && (
            <div className="text-right">
              <p className="font-mono text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                ${mention.quotePrice.toFixed(2)}
              </p>
              {mention.quoteDayChange !== undefined && (
                <p
                  className="font-mono text-xs font-semibold"
                  style={{ color: directionColor }}
                >
                  {mention.quoteDayChange > 0 ? "+" : ""}
                  {mention.quoteDayChange.toFixed(2)}%
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body: Reasoning */}
      <div className="px-4 py-3 space-y-3">
        <p
          className="font-sans text-sm italic"
          style={{ color: "var(--color-text-muted)" }}
        >
          "{mention.reasoning}"
        </p>

        {/* Meta: Sentiment, Strength, Horizon */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          {/* Sentiment */}
          <div className="flex items-center gap-1">
            <span>{SENTIMENT_EMOJI[mention.sentiment] || "?"}</span>
            <span style={{ color: "var(--color-text-muted)" }}>
              {mention.sentiment}
            </span>
          </div>

          {/* Signal Strength */}
          <div className="flex items-center gap-1">
            <span style={{ color: signalColor }}>
              {"●".repeat(mention.signalStrength)}
              {"○".repeat(5 - mention.signalStrength)}
            </span>
          </div>

          {/* Time Horizon */}
          <div style={{ color: "var(--color-text-muted)" }}>
            {mention.timeHorizon}
          </div>
        </div>
      </div>

      {/* Footer: Link to statement */}
      <div
        className="px-4 py-2 border-t text-xs"
        style={{
          borderColor: "var(--color-border)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <a
          href={statementLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono hover:underline"
          style={{ color: "var(--color-accent-gold)" }}
        >
          Read full statement →
        </a>
      </div>
    </div>
  );
}
