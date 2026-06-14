import { db } from "./db";
import { Quote, Mention } from "./types";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

/**
 * Current quote from Yahoo Finance's chart endpoint — same source as Python's
 * `yfinance`. Returns the latest price and the (unused-for-display) daily move.
 */
async function fetchQuoteFromYahoo(ticker: string): Promise<Quote | null> {
  const symbol = ticker.toUpperCase().trim();
  if (!symbol || ["NULL", "NONE", "N/A"].includes(symbol)) return null;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=5d&interval=1d`;

  try {
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`[quotes] Yahoo ${symbol} -> HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (v: number | null): v is number => v != null
    );
    const current: number = closes[closes.length - 1] ?? meta.regularMarketPrice;
    if (current == null) return null;
    const prevClose: number = closes[closes.length - 2] ?? current;
    const dayPct = prevClose ? ((current - prevClose) / prevClose) * 100 : 0;

    return {
      ticker: symbol,
      price: Math.round(current * 100) / 100,
      dayChangePct: Math.round(dayPct * 100) / 100,
      weekChangePct: undefined,
      marketCap: meta.marketCap ?? undefined,
      currency: meta.currency ?? "USD",
      fetchedAt: new Date(),
    };
  } catch (err) {
    console.error(`[quotes] Yahoo ${symbol} error:`, err);
    return null;
  }
}

/**
 * The closing price on (or just before) `date` — i.e. the price around when
 * Trump made the statement. Used as the baseline for "change since mention".
 */
export async function getPriceAsOf(
  ticker: string,
  date: Date
): Promise<number | null> {
  const symbol = ticker.toUpperCase().trim();
  if (!symbol || ["NULL", "NONE", "N/A"].includes(symbol)) return null;

  const target = Math.floor(date.getTime() / 1000);
  const p1 = target - 7 * 86400; // a week of buffer before the statement
  const p2 = Math.floor(Date.now() / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${p1}&period2=${p2}&interval=1d`;

  try {
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const stamps: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    if (!stamps.length) return null;

    // Last trading day whose close is at/just before the statement timestamp.
    let baseline: number | null = null;
    for (let i = 0; i < stamps.length; i++) {
      if (closes[i] == null) continue;
      if (stamps[i] <= target + 86400) baseline = closes[i]!;
      else break;
    }
    // Fall back to the earliest available close if the statement predates data.
    if (baseline == null) baseline = closes.find((c) => c != null) ?? null;
    return baseline != null ? Math.round(baseline * 100) / 100 : null;
  } catch (err) {
    console.error(`[quotes] Yahoo asOf ${symbol} error:`, err);
    return null;
  }
}

/**
 * Daily close series from `fromDate` (minus a small buffer) to now.
 * Powers the per-stock "price since mention" chart.
 */
export async function getPriceSeries(
  ticker: string,
  fromDate: Date
): Promise<{ t: number; close: number }[]> {
  const symbol = ticker.toUpperCase().trim();
  if (!symbol || ["NULL", "NONE", "N/A"].includes(symbol)) return [];

  const p1 = Math.floor(fromDate.getTime() / 1000) - 3 * 86400;
  const p2 = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${p1}&period2=${p2}&interval=1d`;

  try {
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const stamps: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

    const out: { t: number; close: number }[] = [];
    for (let i = 0; i < stamps.length; i++) {
      if (closes[i] == null) continue;
      out.push({ t: stamps[i], close: Math.round(closes[i]! * 100) / 100 });
    }
    return out;
  } catch (err) {
    console.error(`[quotes] Yahoo series ${symbol} error:`, err);
    return [];
  }
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  if (!ticker) return null;
  const upper = ticker.toUpperCase();

  const cached = await db.quote.findUnique({ where: { ticker: upper } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < 5 * 60 * 1000) {
    return toQuote(cached);
  }

  const quote = await fetchQuoteFromYahoo(ticker);
  if (!quote) return cached ? toQuote(cached) : null;

  await db.quote.upsert({
    where: { ticker: upper },
    update: {
      price: quote.price,
      dayChangePct: quote.dayChangePct,
      weekChangePct: quote.weekChangePct ?? null,
      marketCap: quote.marketCap ?? null,
      fetchedAt: new Date(),
    },
    create: {
      ticker: upper,
      price: quote.price,
      dayChangePct: quote.dayChangePct,
      weekChangePct: quote.weekChangePct ?? null,
      marketCap: quote.marketCap ?? null,
      currency: quote.currency,
    },
  });
  return quote;
}

function toQuote(c: {
  ticker: string;
  price: number;
  dayChangePct: number;
  weekChangePct: number | null;
  marketCap: number | null;
  currency: string;
  fetchedAt: Date;
}): Quote {
  return {
    ticker: c.ticker,
    price: c.price,
    dayChangePct: c.dayChangePct,
    weekChangePct: c.weekChangePct ?? undefined,
    marketCap: c.marketCap ?? undefined,
    currency: c.currency,
    fetchedAt: c.fetchedAt,
  };
}

function pctChange(current: number, base: number): number {
  return base ? Math.round(((current - base) / base) * 10000) / 100 : 0;
}

/**
 * Attach quotes to mentions. `quoteDayChange` is the % move since the statement
 * was published (current price vs the price at publish time).
 */
export async function enrichMentionsWithQuotes(
  mentions: Mention[],
  publishedAt: Date
): Promise<Mention[]> {
  return Promise.all(
    mentions.map(async (mention) => {
      if (!mention.ticker) return mention;
      const current = await getQuote(mention.ticker);
      if (!current) return mention;

      const base = await getPriceAsOf(mention.ticker, publishedAt);
      const changeSince =
        base != null ? pctChange(current.price, base) : current.dayChangePct;

      return {
        ...mention,
        quotePrice: current.price,
        basePrice: base ?? undefined,
        quoteDayChange: changeSince,
        dayChangePct: current.dayChangePct,
        quoteUpdatedAt: current.fetchedAt,
      };
    })
  );
}

/**
 * Refresh prices on existing mentions each scrape. Keeps the publish-time
 * baseline fixed and recomputes the change-since-mention against the latest
 * price. Backfills `basePrice` for older rows that predate the column.
 */
export async function refreshMentionQuotes(): Promise<number> {
  const mentions = await db.mention.findMany({
    where: { ticker: { not: null } },
    select: {
      id: true,
      ticker: true,
      basePrice: true,
      statement: { select: { published: true } },
    },
  });

  // One current-price fetch per unique ticker.
  const tickers = [...new Set(mentions.map((m) => m.ticker!.toUpperCase()))];
  const current = new Map<string, Quote | null>();
  for (const t of tickers) current.set(t, await getQuote(t));

  // Cache baselines per (ticker, day) so we don't refetch history repeatedly.
  const baseCache = new Map<string, number | null>();

  let updated = 0;
  for (const m of mentions) {
    const cur = current.get(m.ticker!.toUpperCase());
    if (!cur) continue;

    let base = m.basePrice ?? null;
    if (base == null) {
      const dayKey = `${m.ticker}:${m.statement.published.toISOString().slice(0, 10)}`;
      if (!baseCache.has(dayKey)) {
        baseCache.set(dayKey, await getPriceAsOf(m.ticker!, m.statement.published));
      }
      base = baseCache.get(dayKey) ?? null;
    }

    const changeSince = base != null ? pctChange(cur.price, base) : cur.dayChangePct;

    await db.mention.update({
      where: { id: m.id },
      data: {
        quotePrice: cur.price,
        basePrice: base ?? undefined,
        quoteDayChange: changeSince,
        dayChangePct: cur.dayChangePct,
        quoteUpdatedAt: cur.fetchedAt,
      },
    });
    updated++;
  }
  return updated;
}
