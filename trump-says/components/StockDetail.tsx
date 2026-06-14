"use client";

import { useEffect, useState } from "react";

const SIGNAL_COLOR: Record<string, string> = {
  BUY: "var(--green)",
  SELL: "var(--red)",
  WATCH: "var(--amber)",
  AVOID: "var(--violet)",
};

interface DetailMention {
  id: string;
  title: string;
  link?: string;
  source: string;
  published: string;
  signal: string;
  sentiment: string;
  signalStrength: number;
  reasoning: string;
  basePrice?: number | null;
  quotePrice?: number | null;
  quoteDayChange?: number | null;
}

interface StockData {
  ticker: string;
  name: string;
  series: { t: number; close: number }[];
  mentions: DetailMention[];
}

function fmtDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();
}

/* ───────────────────────────────────────────────────────────── Chart ── */
function Chart({
  series,
  mentions,
}: {
  series: { t: number; close: number }[];
  mentions: DetailMention[];
}) {
  if (series.length < 2) {
    return (
      <div className="mono" style={{ padding: "40px 0", color: "var(--fg-3)", fontSize: 12 }}>
        NOT ENOUGH PRICE HISTORY TO CHART
      </div>
    );
  }

  const W = 720, H = 240, padL = 4, padR = 4, padT = 18, padB = 22;
  const closes = series.map((s) => s.close);
  const tMin = series[0].t;
  const tMax = series[series.length - 1].t;
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const yPad = (hi - lo) * 0.1 || 1;
  const y0 = lo - yPad;
  const y1 = hi + yPad;

  const xOf = (t: number) =>
    padL + (tMax === tMin ? 0 : (t - tMin) / (tMax - tMin)) * (W - padL - padR);
  const yOf = (v: number) => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);

  const linePath = series
    .map((s, i) => `${i ? "L" : "M"}${xOf(s.t).toFixed(1)} ${yOf(s.close).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${xOf(tMax).toFixed(1)} ${H - padB} L${xOf(tMin).toFixed(1)} ${H - padB} Z`;

  const first = series[0].close;
  const last = series[series.length - 1].close;
  const up = last >= first;
  const lineColor = up ? "var(--green)" : "var(--red)";
  const gid = "g-" + Math.random().toString(36).slice(2, 7);

  // Nearest series close for a given timestamp (to anchor a mention marker)
  const closeAt = (t: number) => {
    let best = series[0];
    let bestD = Infinity;
    for (const s of series) {
      const d = Math.abs(s.t - t);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best.close;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.16" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gid})`} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* mention markers */}
        {mentions.map((m) => {
          const t = Math.floor(new Date(m.published).getTime() / 1000);
          const ct = Math.min(Math.max(t, tMin), tMax);
          const x = xOf(ct);
          const y = yOf(closeAt(ct));
          const c = SIGNAL_COLOR[m.signal] ?? "var(--fg-2)";
          return (
            <g key={m.id}>
              <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="var(--line-2)" strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={x} cy={y} r="3.5" fill="var(--surface)" stroke={c} strokeWidth="2" />
            </g>
          );
        })}

        {/* price bounds */}
        <text x={padL} y={yOf(hi) - 4} className="mono" fontSize="10" fill="var(--fg-3)">
          ${hi.toFixed(2)}
        </text>
        <text x={padL} y={yOf(lo) + 12} className="mono" fontSize="10" fill="var(--fg-3)">
          ${lo.toFixed(2)}
        </text>
      </svg>

      {/* x-axis range */}
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg-3)", marginTop: 4, letterSpacing: "0.05em" }}>
        <span>{fmtDate(new Date(tMin * 1000).toISOString())}</span>
        <span>{fmtDate(new Date(tMax * 1000).toISOString())}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── StockDetail ── */
export function StockDetail({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [ticker]);

  const current = data?.series.at(-1)?.close ?? data?.mentions[0]?.quotePrice ?? null;
  const firstClose = data?.series[0]?.close ?? null;
  const sincePct =
    current != null && firstClose ? ((current - firstClose) / firstClose) * 100 : null;
  const up = (sincePct ?? 0) >= 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "color-mix(in srgb, var(--fg) 28%, transparent)",
        backdropFilter: "blur(3px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "5vh 16px", overflowY: "auto",
        animation: "rise .18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 720,
          background: "var(--surface)",
          border: "1px solid var(--line-2)",
          borderRadius: 12,
          boxShadow: "0 20px 60px -20px rgba(0,0,0,.4)",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "22px 24px 16px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>
                {data?.name ?? ticker}
              </h2>
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-3)", letterSpacing: "0.04em" }}>
                {data?.ticker ?? ticker}
              </span>
            </div>
            {current != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                  ${current.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {sincePct != null && (
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: up ? "var(--green)" : "var(--red)" }}>
                    {up ? "▲" : "▼"} {up ? "+" : ""}{sincePct.toFixed(2)}% since first mention
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "1px solid var(--line-2)", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "var(--fg-2)", fontSize: 14, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div style={{ padding: "20px 24px 28px" }}>
          {loading ? (
            <div className="mono" style={{ padding: "40px 0", color: "var(--fg-3)", fontSize: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, border: "1.5px solid var(--line-2)", borderTopColor: "var(--fg-2)", borderRadius: "50%", animation: "spin .6s linear infinite" }} />
              LOADING CHART…
            </div>
          ) : !data || data.mentions.length === 0 ? (
            <div className="mono" style={{ padding: "40px 0", color: "var(--fg-3)", fontSize: 12 }}>
              NO DATA FOR THIS STOCK
            </div>
          ) : (
            <>
              <Chart series={data.series} mentions={data.mentions} />

              {/* mentions list */}
              <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--fg-3)", margin: "28px 0 4px", textTransform: "uppercase" }}>
                {data.mentions.length} Mention{data.mentions.length > 1 ? "s" : ""}
              </div>

              {data.mentions.map((m) => {
                const c = SIGNAL_COLOR[m.signal] ?? "var(--fg-2)";
                const change = m.quoteDayChange;
                const chColor = change == null ? "var(--fg-3)" : change >= 0 ? "var(--green)" : "var(--red)";
                return (
                  <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, padding: "16px 0", borderTop: "1px solid var(--line)", alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--fg-3)", marginBottom: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: c, fontWeight: 600 }}>{m.signal}</span>
                        <span aria-hidden>·</span>
                        <span style={{ color: c, letterSpacing: 1 }}>
                          {"●".repeat(m.signalStrength)}{"○".repeat(Math.max(0, 5 - m.signalStrength))}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{fmtDate(m.published)}</span>
                      </div>
                      {m.link ? (
                        <a href={m.link} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)", textDecoration: "none", lineHeight: 1.45 }}>
                          {m.title} <span style={{ color: "var(--fg-3)" }}>↗</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: 14, lineHeight: 1.45 }}>{m.title}</span>
                      )}
                      {m.reasoning && (
                        <p style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 6, lineHeight: 1.55 }}>{m.reasoning}</p>
                      )}
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {m.basePrice != null && (
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                          ${m.basePrice.toFixed(2)}
                        </div>
                      )}
                      {change != null && (
                        <div className="mono" style={{ fontSize: 11, color: chColor, marginTop: 4 }}>
                          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                        </div>
                      )}
                      <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.06em", color: "var(--fg-3)", marginTop: 3 }}>
                        AT MENTION
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
