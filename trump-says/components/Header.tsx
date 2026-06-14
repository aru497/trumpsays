"use client";

import { useEffect, useState } from "react";

interface HeaderProps {
  totalSignals: number;
  buyCount: number;
  sellCount: number;
  watchCount: number;
  avoidCount: number;
  lastUpdated?: Date;
}

export function Header({
  totalSignals,
  buyCount,
  sellCount,
  watchCount,
  avoidCount,
  lastUpdated,
}: HeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDarkMode =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const formatTime = (date: Date | undefined) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor(diff / 1000);

    if (minutes > 60) {
      return `${Math.floor(minutes / 60)}h ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return "Just now";
  };

  return (
    <header
      className="sticky top-0 z-40 w-full animate-slideDown"
      style={{
        background:
          "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-10 sm:py-12">
          {/* Left: Title and Subtitle */}
          <div>
            <h1
              className="font-serif text-4xl font-bold"
              style={{ color: "var(--color-accent-gold)" }}
            >
              TrumpSays
            </h1>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Political Market Signals
            </p>
          </div>

          {/* Right: Stats and Controls */}
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
              <div>
                <span style={{ color: "var(--color-accent-gold)" }} className="font-bold">
                  {totalSignals}
                </span>{" "}
                <span style={{ color: "var(--color-text-muted)" }}>signals</span>
              </div>
              <div>
                <span style={{ color: "var(--color-buy)" }} className="font-bold">
                  {buyCount}
                </span>{" "}
                <span style={{ color: "var(--color-text-muted)" }}>BUY</span>
              </div>
              <div>
                <span style={{ color: "var(--color-sell)" }} className="font-bold">
                  {sellCount}
                </span>{" "}
                <span style={{ color: "var(--color-text-muted)" }}>SELL</span>
              </div>
            </div>

            {/* Update Time */}
            <div className="text-right">
              <p
                className="text-xs font-mono font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Updated
              </p>
              <p className="text-xs font-mono font-semibold" style={{ color: "var(--color-accent-gold)" }}>
                {mounted ? formatTime(lastUpdated) : "..."}
              </p>
            </div>

            {/* Dark Mode Toggle */}
            {mounted && (
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded transition-colors"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "var(--color-accent-gold)",
                }}
                title="Toggle dark mode"
              >
                {isDark ? "☀️" : "🌙"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
