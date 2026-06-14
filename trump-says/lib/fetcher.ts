import FeedParser from "feedparser";
import * as http from "http";
import * as https from "https";
import { RawStatement } from "./types";

// Google News RSS search queries. A date window is appended at fetch time
// using Google News's `when:Nd` operator (e.g. "when:15d" = last 15 days).
const FEED_QUERIES = [
  "Trump says company",
  "Trump tariff trade deal stock",
  "Trump speech press conference announces",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; TrumpSays/1.0)",
};

function buildFeedUrl(query: string, windowDays?: number): string {
  const q = windowDays ? `${query} when:${windowDays}d` : query;
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(q) +
    "&hl=en-US&gl=US&ceid=US:en"
  );
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

async function fetchFeed(url: string): Promise<RawStatement[]> {
  return new Promise((resolve) => {
    const results: RawStatement[] = [];
    const seen = new Set<string>();
    const protocol = url.startsWith("https") ? https : http;

    const req = protocol.get(url, { headers: HEADERS }, (res) => {
      const parser = new FeedParser();

      parser.on("readable", function () {
        let item;
        while ((item = parser.read())) {
          const key = (item.title || "").substring(0, 60).toLowerCase();
          if (key && !seen.has(key)) {
            seen.add(key);
            results.push({
              title: item.title || "",
              summary: stripHtml(item.summary || item.description || ""),
              link: item.link || "#",
              published: item.pubDate
                ? new Date(item.pubDate).toISOString()
                : new Date().toISOString(),
              source: item.source?.title || "Google News – Trump",
            });
          }
        }
      });

      parser.on("error", () => resolve(results));
      parser.on("end", () => resolve(results));
      res.pipe(parser);
    });

    req.on("error", () => resolve(results));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve(results);
    });
  });
}

export interface FetchOptions {
  /** Max items kept per feed query. */
  maxPerFeed?: number;
  /** Only return statements published strictly after this date. */
  since?: Date | null;
  /** Restrict Google News results to the last N days (uses `when:Nd`). */
  windowDays?: number;
}

export async function fetchStatements(
  opts: FetchOptions = {}
): Promise<RawStatement[]> {
  const { maxPerFeed = 50, since = null, windowDays } = opts;

  const allResults: RawStatement[] = [];
  const seen = new Set<string>();

  const feedPromises = FEED_QUERIES.map((query) =>
    fetchFeed(buildFeedUrl(query, windowDays))
      .then((items) =>
        items.slice(0, maxPerFeed).filter((item) => {
          const key = item.link;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
      )
      .catch(() => [])
  );

  const results = await Promise.all(feedPromises);
  results.forEach((items) => allResults.push(...items));

  // Incremental mode: drop anything we've already seen by timestamp.
  const filtered = since
    ? allResults.filter((s) => new Date(s.published).getTime() > since.getTime())
    : allResults;

  // Newest first
  filtered.sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  );

  return filtered;
}
