"use client";

import { useState } from "react";

export type FilterType = "all" | "BUY" | "SELL" | "WATCH" | "AVOID";
export type SentimentType = "all" | "bullish" | "bearish" | "neutral";

interface FilterBarProps {
  onFilterChange: (filter: FilterType) => void;
  onSentimentChange: (sentiment: SentimentType) => void;
  onSearchChange: (search: string) => void;
  activeFilter: FilterType;
  activeSentiment: SentimentType;
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

export function FilterBar({
  onFilterChange,
  onSentimentChange,
  onSearchChange,
  activeFilter,
  activeSentiment,
}: FilterBarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchChange(value);
  };

  return (
    <div
      className="sticky top-20 z-30 w-full px-4 sm:px-6 lg:px-8 py-4 animate-fadeIn"
      style={{
        background: "var(--color-bg-secondary)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="space-y-4">
          {/* Signal Filters */}
          <div className="flex flex-wrap gap-2">
            {(["all", "BUY", "SELL", "WATCH", "AVOID"] as FilterType[]).map(
              (signal) => (
                <button
                  key={signal}
                  onClick={() => onFilterChange(signal)}
                  className={`px-4 py-2 rounded text-sm font-semibold uppercase transition-all ${
                    activeFilter === signal
                      ? "ring-2 ring-offset-2"
                      : "border border-transparent opacity-75"
                  }`}
                  style={{
                    background:
                      activeFilter === signal
                        ? signal === "all"
                          ? "var(--color-accent-gold)"
                          : SIGNAL_COLORS[signal]
                        : "var(--color-bg-tertiary)",
                    color:
                      activeFilter === signal
                        ? signal === "all"
                          ? "var(--color-primary)"
                          : "#fff"
                        : "var(--color-text)",
                    outline: activeFilter === signal ? "2px solid currentColor" : "none",
                    outlineOffset: activeFilter === signal ? "2px" : "0",
                  }}
                >
                  {signal !== "all" && `${SIGNAL_ICONS[signal]} `}
                  {signal === "all" ? "All Signals" : signal}
                </button>
              )
            )}
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sentiment Filter */}
            <select
              value={activeSentiment}
              onChange={(e) => onSentimentChange(e.target.value as SentimentType)}
              className="px-3 py-2 rounded text-sm font-medium border transition-all"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-text)",
                borderColor: "var(--color-border)",
              }}
            >
              <option value="all">All Sentiments</option>
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 min-w-max px-3 py-2 rounded text-sm border transition-all"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-text)",
                borderColor: "var(--color-border)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
