import { fetchStatements } from "../fetcher";
import { analyzeStatement } from "../analyzer";
import { enrichMentionsWithQuotes, refreshMentionQuotes } from "../quotes";
import { PollingResult } from "../types";

let isPolling = false;

// A scheduled run makes exactly ONE Groq call (analyses one new statement),
// keeping us comfortably inside Groq's free-tier limits. Explicit backfills
// may process more per run (still time-bounded below). Backfill is idempotent
// (dedup by link), so re-running continues where it left off.
const NORMAL_PER_RUN = 1;
const BACKFILL_PER_RUN = 15;
const FALLBACK_WINDOW_DAYS = 15;
// Stop processing before Vercel's 60s function cap so the run always returns
// cleanly. Remaining items are picked up on the next (idempotent) run.
const TIME_BUDGET_MS = 50_000;

export interface PollingOptions {
  /** Force a historical backfill over the last N days, ignoring the last-seen timestamp. */
  backfillDays?: number;
}

export async function runPollingJob(
  options: PollingOptions = {}
): Promise<PollingResult> {
  const { db } = await import("../db");

  if (isPolling) {
    console.log("[polling] Already polling, skipping...");
    return {
      articlesProcessed: 0,
      mentionsFound: 0,
      statementsCreated: 0,
      duration: 0,
    };
  }

  isPolling = true;
  const startTime = Date.now();

  try {
    console.log("[polling] Starting polling job...");

    // Determine the last known statement timestamp to fetch incrementally.
    const latest = await db.statement.findFirst({
      orderBy: { published: "desc" },
      select: { published: true },
    });

    let statements;
    if (options.backfillDays) {
      // Explicit backfill: pull the whole window, ignore the last-seen cursor.
      console.log(`[polling] Backfill mode: last ${options.backfillDays} days`);
      statements = await fetchStatements({
        windowDays: options.backfillDays,
        maxPerFeed: 100,
      });
    } else if (latest) {
      // Incremental: only items newer than what we already have.
      statements = await fetchStatements({
        since: latest.published,
        windowDays: 7,
        maxPerFeed: 50,
      });
    } else {
      // Cold start (no history): grab at least the last 15 days.
      console.log(`[polling] No history — fetching last ${FALLBACK_WINDOW_DAYS} days`);
      statements = await fetchStatements({
        windowDays: FALLBACK_WINDOW_DAYS,
        maxPerFeed: 100,
      });
    }

    // Safety net: if a window fetch returns nothing, widen to 15 days.
    if (statements.length === 0 && !options.backfillDays) {
      console.log(`[polling] 0 articles — widening to ${FALLBACK_WINDOW_DAYS} days`);
      statements = await fetchStatements({
        windowDays: FALLBACK_WINDOW_DAYS,
        maxPerFeed: 100,
      });
    }

    console.log(`[polling] Fetched ${statements.length} articles`);

    if (statements.length === 0) {
      await db.pollingLog.create({
        data: {
          articlesFound: 0,
          mentionsExtracted: 0,
          duration: Date.now() - startTime,
        },
      });
      return {
        articlesProcessed: 0,
        mentionsFound: 0,
        statementsCreated: 0,
        duration: Date.now() - startTime,
      };
    }

    let mentionCount = 0;
    let statementsCreated = 0;
    const perRun = options.backfillDays ? BACKFILL_PER_RUN : NORMAL_PER_RUN;

    // Process each statement
    for (const stmt of statements) {
      if (statementsCreated >= perRun) {
        console.log(`[polling] Hit per-run cap (${perRun}); remaining items next run`);
        break;
      }
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log("[polling] Hit time budget; remaining items next run");
        break;
      }
      try {
        // Check if already exists
        const existing = await db.statement.findUnique({
          where: { link: stmt.link },
        });

        if (existing) {
          console.log(
            `[polling] Statement already exists: ${stmt.title.substring(0, 50)}`
          );
          continue;
        }

        // Analyze statement with the LLM
        console.log(
          `[polling] Analyzing: ${stmt.title.substring(0, 50)}...`
        );
        const analysis = await analyzeStatement(stmt.title, stmt.summary);

        // Enrich mentions with quotes (no-op for empty analyses). We still
        // persist statements with zero mentions so they're deduped next run
        // and the incremental cursor advances — they're filtered out of the
        // feed by the /api/statements query.
        const enrichedMentions = await enrichMentionsWithQuotes(
          analysis.mentions,
          new Date(stmt.published)
        );

        // Save to database
        const created = await db.statement.create({
          data: {
            title: stmt.title,
            summary: stmt.summary,
            link: stmt.link,
            published: new Date(stmt.published),
            source: stmt.source,
            analysis: {
              create: {
                statementSummary: analysis.statementSummary || stmt.title,
                macroTheme: analysis.macroTheme,
                affectedRegions: analysis.affectedRegions || [],
              },
            },
            mentions: {
              create: enrichedMentions.map((m) => ({
                name: m.name,
                ticker: m.ticker,
                type: m.type,
                sentiment: m.sentiment,
                signal: m.signal,
                signalStrength: m.signalStrength,
                reasoning: m.reasoning,
                timeHorizon: m.timeHorizon,
                quotePrice: m.quotePrice,
                basePrice: m.basePrice,
                quoteDayChange: m.quoteDayChange,
                dayChangePct: m.dayChangePct,
                quoteUpdatedAt: m.quoteUpdatedAt,
              })),
            },
          },
          include: {
            mentions: true,
            analysis: true,
          },
        });

        mentionCount += enrichedMentions.length;
        statementsCreated++;

        console.log(
          `[polling] Created statement with ${enrichedMentions.length} mentions`
        );

        // Light spacing to stay under Groq's rate limits (RPM 30 / TPM 30K).
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        console.error("[polling] Error processing statement:", err);
        continue;
      }
    }

    // Refresh quote prices on all existing mentions so the tape stays live
    // (mention prices are frozen at creation time otherwise). Skip during a
    // backfill — newly created mentions already carry fresh quotes, and the
    // full sweep would push the run past the function timeout.
    if (!options.backfillDays) {
      try {
        const refreshed = await refreshMentionQuotes();
        console.log(`[polling] Refreshed quotes on ${refreshed} mentions`);
      } catch (err) {
        console.error("[polling] Quote refresh failed:", err);
      }
    }

    const duration = Date.now() - startTime;

    // Log polling result
    await db.pollingLog.create({
      data: {
        articlesFound: statements.length,
        mentionsExtracted: mentionCount,
        duration,
      },
    });

    console.log(
      `[polling] Completed: ${statementsCreated} statements, ${mentionCount} mentions in ${duration}ms`
    );

    return {
      articlesProcessed: statements.length,
      mentionsFound: mentionCount,
      statementsCreated,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[polling] Error during polling:", errorMessage);

    await db.pollingLog.create({
      data: {
        articlesFound: 0,
        mentionsExtracted: 0,
        errorMessage,
        duration,
      },
    });

    return {
      articlesProcessed: 0,
      mentionsFound: 0,
      statementsCreated: 0,
      duration,
    };
  } finally {
    isPolling = false;
  }
}

export function isCurrentlyPolling(): boolean {
  return isPolling;
}
