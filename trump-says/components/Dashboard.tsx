"use client";

import { useCallback, useEffect, useState } from "react";
import { StockDetail } from "./StockDetail";

type Direction = "up" | "down" | "flat";
type Filter = "all" | "up" | "down";
type Metric = "first" | "today";

interface Mention {
  id: string;
  name: string;
  ticker?: string | null;
  signal: string;
  signalStrength?: number | null;
  reasoning: string;
  quotePrice?: number | null;
  basePrice?: number | null;
  quoteDayChange?: number | null;
  dayChangePct?: number | null;
}

interface Statement {
  id: string;
  title: string;
  link?: string;
  published: string;
  source: string;
  mentions: Mention[];
}

interface Company {
  key: string;
  name: string;
  ticker?: string;
  price?: number;
  sinceFirst?: number; // % since the FIRST time Trump named it
  today?: number; // today's daily % move
  firstDate: string;
  latestHeadline: string;
  latestLink?: string;
  latestSource: string;
  signal: string;
  strength: number;
  mentionCount: number;
}

const SIGNAL_COLOR: Record<string, string> = {
  BUY: "var(--green)",
  SELL: "var(--red)",
  WATCH: "var(--amber)",
  AVOID: "var(--violet)",
};

function cleanTicker(t?: string | null): string | undefined {
  if (!t) return undefined;
  const u = t.trim().toUpperCase();
  return !u || ["NULL", "NONE", "N/A", "-"].includes(u) ? undefined : u;
}

function direction(v?: number): Direction {
  if (v == null) return "flat";
  if (v > 0.3) return "up";
  if (v < -0.3) return "down";
  return "flat";
}

function fmtDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();
}

/**
 * Collapse all mentions of a stock into one company record. Performance is
 * anchored to the FIRST mention (the moment Trump first named it); a fresh
 * mention adds to the count but never resets the baseline.
 */
function aggregate(statements: Statement[]): Company[] {
  const groups = new Map<string, { s: Statement; m: Mention }[]>();
  for (const s of statements) {
    for (const m of s.mentions ?? []) {
      // Only track tradable tickers — commodities/sectors without a ticker
      // can't be priced, so they don't belong on the leaderboard.
      const ticker = cleanTicker(m.ticker);
      if (!ticker) continue;
      (groups.get(ticker) ?? groups.set(ticker, []).get(ticker)!).push({ s, m });
    }
  }

  const companies: Company[] = [];
  for (const [key, items] of groups) {
    items.sort(
      (a, b) => new Date(a.s.published).getTime() - new Date(b.s.published).getTime()
    );
    const first = items[0];
    const latest = items[items.length - 1];

    const price =
      [...items].reverse().find((i) => i.m.quotePrice != null)?.m.quotePrice ?? undefined;
    const firstBase = first.m.basePrice ?? undefined;
    const sinceFirst =
      price != null && firstBase ? ((price - firstBase) / firstBase) * 100 : undefined;
    const today =
      [...items].reverse().find((i) => i.m.dayChangePct != null)?.m.dayChangePct ?? undefined;

    companies.push({
      key,
      name: latest.m.name,
      ticker: key,
      price,
      sinceFirst: sinceFirst != null ? Math.round(sinceFirst * 100) / 100 : undefined,
      today: today != null ? Math.round(today * 100) / 100 : undefined,
      firstDate: first.s.published,
      latestHeadline: latest.s.title,
      latestLink: latest.s.link,
      latestSource: latest.s.source,
      signal: latest.m.signal ?? "WATCH",
      strength: latest.m.signalStrength ?? 0,
      mentionCount: items.length,
    });
  }
  return companies;
}

const metricVal = (c: Company, metric: Metric) =>
  metric === "first" ? c.sinceFirst : c.today;

/* ───────────────────────────────────────────────────────────── Row ── */
function LedgerRow({
  company: c,
  rank,
  metric,
  onOpen,
}: {
  company: Company;
  rank: number;
  metric: Metric;
  onOpen?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const clickable = !!c.ticker;
  const sigColor = SIGNAL_COLOR[c.signal] ?? "var(--fg-2)";

  const primary = metricVal(c, metric);
  const secondary = metric === "first" ? c.today : c.sinceFirst;
  const primaryLabel = metric === "first" ? "SINCE FIRST" : "TODAY";
  const secondaryLabel = metric === "first" ? "TODAY" : "SINCE FIRST";

  const dir = direction(primary);
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "·";
  const pColor = dir === "up" ? "var(--green)" : dir === "down" ? "var(--red)" : "var(--fg-3)";
  const sColor =
    secondary == null ? "var(--fg-3)" : secondary >= 0 ? "var(--green)" : "var(--red)";

  const quote = c.latestHeadline.length > 92 ? c.latestHeadline.slice(0, 92) + "…" : c.latestHeadline;

  return (
    <article
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={clickable ? onOpen : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr auto",
        columnGap: 18,
        padding: "22px 24px",
        borderTop: "1px solid var(--line)",
        background: hov ? "var(--hover)" : "transparent",
        transition: "background .12s ease",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {/* rank gutter */}
      <div
        className="mono"
        style={{ fontSize: 11, fontWeight: 500, color: hov ? sigColor : "var(--fg-3)", paddingTop: 3, transition: "color .12s", letterSpacing: "0.02em" }}
      >
        {String(rank).padStart(2, "0")}
      </div>

      {/* main */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>{c.name}</h3>
          {c.ticker && (
            <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: "var(--fg-3)", letterSpacing: "0.04em" }}>{c.ticker}</span>
          )}
        </div>

        <p style={{ fontSize: 13, color: "var(--fg-2)", fontStyle: "italic", margin: "7px 0 10px", lineHeight: 1.55, maxWidth: "52ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          “{quote}”
        </p>

        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.07em", color: "var(--fg-3)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: sigColor, fontWeight: 600 }}>{c.signal}</span>
          <span aria-hidden>·</span>
          <span style={{ color: sigColor, letterSpacing: 1 }}>
            {"●".repeat(c.strength)}{"○".repeat(Math.max(0, 5 - c.strength))}
          </span>
          <span aria-hidden>·</span>
          {c.latestLink ? (
            <a
              href={c.latestLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Read the article"
              onClick={(e) => e.stopPropagation()}
              style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--fg)"; e.currentTarget.style.borderBottomColor = "var(--fg-3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; e.currentTarget.style.borderBottomColor = "transparent"; }}
            >
              {c.latestSource.toUpperCase()} ↗
            </a>
          ) : (
            <span>{c.latestSource.toUpperCase()}</span>
          )}
          <span aria-hidden>·</span>
          <span>{c.mentionCount} MENTION{c.mentionCount > 1 ? "S" : ""}</span>
          <span aria-hidden>·</span>
          <span>SINCE {fmtDate(c.firstDate)}</span>
        </div>
      </div>

      {/* price + dual metric */}
      <div style={{ textAlign: "right", whiteSpace: "nowrap", paddingTop: 1 }}>
        {c.price != null ? (
          <div className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--fg-2)" }}>
            <span style={{ color: "var(--fg-3)", fontSize: 11, fontWeight: 400 }}>$</span>
            {c.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ) : null}

        {/* primary metric */}
        <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: pColor, marginTop: 8, letterSpacing: "-0.02em" }}>
          {primary != null ? `${arrow} ${primary > 0 ? "+" : ""}${primary.toFixed(2)}%` : "—"}
        </div>
        <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "var(--fg-3)", marginTop: 2 }}>{primaryLabel}</div>

        {/* secondary metric */}
        <div className="mono" style={{ fontSize: 11, fontWeight: 500, color: sColor, marginTop: 8 }}>
          {secondary != null ? `${secondary > 0 ? "+" : ""}${secondary.toFixed(2)}%` : "—"}
          <span style={{ color: "var(--fg-3)", marginLeft: 5, fontSize: 8.5, letterSpacing: "0.08em" }}>{secondaryLabel}</span>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────── Dashboard ── */
export function Dashboard() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [metric, setMetric] = useState<Metric>("first");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/statements?limit=100");
      const data = await res.json();
      setStatements(data.statements ?? []);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const companies = aggregate(statements);
  const filtered = companies.filter((c) => {
    const d = direction(metricVal(c, metric));
    return filter === "up" ? d === "up" : filter === "down" ? d === "down" : true;
  });
  // Rank: best performers (by selected metric) first.
  filtered.sort((a, b) => (metricVal(b, metric) ?? -Infinity) - (metricVal(a, metric) ?? -Infinity));

  const nUp = companies.filter((c) => direction(metricVal(c, metric)) === "up").length;
  const nDown = companies.filter((c) => direction(metricVal(c, metric)) === "down").length;

  /* ── tokens ── */
  const SHEET: React.CSSProperties = {
    maxWidth: 760, margin: "0 auto",
    borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)",
    minHeight: "100vh", background: "var(--surface)",
  };
  const PAD = "0 24px";
  const TAB = (active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "7px 0", marginRight: 22, background: "none", border: "none",
    borderBottom: active ? "1.5px solid var(--fg)" : "1.5px solid transparent",
    color: active ? "var(--fg)" : "var(--fg-3)", cursor: "pointer", transition: "color .12s",
    fontFamily: "'JetBrains Mono', monospace",
  });
  const SEG = (active: boolean): React.CSSProperties => ({
    fontSize: 10.5, fontWeight: 500, letterSpacing: "0.05em",
    padding: "6px 12px", borderRadius: 6, cursor: "pointer",
    border: "1px solid", borderColor: active ? "var(--fg)" : "var(--line-2)",
    background: active ? "var(--fg)" : "transparent",
    color: active ? "var(--surface)" : "var(--fg-2)",
    fontFamily: "'JetBrains Mono', monospace", transition: "all .1s",
  });
  const STAT_N = (c?: string): React.CSSProperties => ({
    fontSize: 30, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1,
    color: c ?? "var(--fg)", fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums",
  });
  const STAT_L: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--fg-3)", marginTop: 7, fontFamily: "'JetBrains Mono', monospace",
  };

  return (
    <div style={{ background: "var(--bg)" }}>
      <div style={SHEET}>
        {/* ── Nav ── */}
        <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "color-mix(in srgb, var(--surface) 88%, transparent)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--line)", height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: PAD }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>TRUMPSAYS</span>
          <div className="mono" style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 10.5, letterSpacing: "0.05em" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--fg-2)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", animation: "blink 2s ease-in-out infinite" }} />
              LIVE
            </span>
            {updatedAt && <span style={{ color: "var(--fg-3)" }}>{updatedAt}</span>}
            {mounted && (
              <button onClick={toggleTheme} style={{ background: "none", border: "1px solid var(--line-2)", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 10, letterSpacing: "0.08em", color: "var(--fg-2)", fontFamily: "inherit" }}>
                {isDark ? "LIGHT" : "DARK"}
              </button>
            )}
          </div>
        </nav>

        {/* ── Hero ── */}
        <header style={{ padding: "64px 24px 36px" }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--fg-3)", marginBottom: 22, textTransform: "uppercase" }}>Political Market Signals</div>
          <h1 style={{ fontSize: "clamp(38px, 8vw, 62px)", fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.98 }}>
            Named.<span style={{ color: "var(--fg-3)" }}> Tracked.</span><span style={{ color: "var(--fg-3)" }}> Priced.</span>
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--fg-2)", maxWidth: "46ch", margin: "22px 0 0" }}>
            Every company Trump names — on Truth Social, in a speech, at a press conference —
            tracked from the moment he first said it.
          </p>
        </header>

        {/* ── Stats ── */}
        {!loading && (
          <div style={{ display: "flex", gap: 40, padding: "0 24px 28px", animation: "rise .4s ease" }}>
            <div>
              <div style={STAT_N()}>{String(companies.length).padStart(2, "0")}</div>
              <div style={STAT_L}>Companies</div>
            </div>
            <div>
              <div style={STAT_N("var(--green)")}>{String(nUp).padStart(2, "0")}</div>
              <div style={STAT_L}>Rallied</div>
            </div>
            <div>
              <div style={STAT_N("var(--red)")}>{String(nDown).padStart(2, "0")}</div>
              <div style={STAT_L}>Dropped</div>
            </div>
          </div>
        )}

        {/* ── Metric toggle ── */}
        <div style={{ padding: "0 24px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "var(--fg-3)" }}>TRACK</span>
          <button style={SEG(metric === "first")} onClick={() => setMetric("first")}>SINCE FIRST MENTION</button>
          <button style={SEG(metric === "today")} onClick={() => setMetric("today")}>TODAY</button>
        </div>

        {/* ── Filter tabs ── */}
        <div style={{ padding: PAD, borderBottom: "1px solid var(--line)", display: "flex" }}>
          {(["all", "up", "down"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={TAB(filter === f)}>
              {f === "all" ? "All" : f === "up" ? "Rallied" : "Dropped"}
            </button>
          ))}
        </div>

        {/* ── Ranked feed ── */}
        <main>
          {loading ? (
            <div className="mono" style={{ padding: "48px 24px", color: "var(--fg-3)", fontSize: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, border: "1.5px solid var(--line-2)", borderTopColor: "var(--fg-2)", borderRadius: "50%", animation: "spin .6s linear infinite" }} />
              LOADING TAPE…
            </div>
          ) : filtered.length === 0 ? (
            <div className="mono" style={{ padding: "48px 24px", color: "var(--fg-3)", fontSize: 12 }}>
              NO COMPANIES YET — CHECK BACK SOON
            </div>
          ) : (
            filtered.map((c, i) => (
              <LedgerRow
                key={c.key}
                company={c}
                rank={i + 1}
                metric={metric}
                onOpen={() => c.ticker && setSelected(c.ticker)}
              />
            ))
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="mono" style={{ borderTop: "1px solid var(--line)", padding: "20px 24px 36px", fontSize: 10, lineHeight: 1.7, color: "var(--fg-3)", letterSpacing: "0.03em" }}>
          INFORMATIONAL ONLY · NOT FINANCIAL ADVICE<br />
          TAPE REFRESHES EVERY 15 MINUTES · ANALYSIS BY GROQ LLAMA-4
        </footer>
      </div>

      {selected && <StockDetail ticker={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
