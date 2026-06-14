import { groq, GROQ_MODEL, ANALYST_SYSTEM_PROMPT } from "./groq";
import { AnalysisResult, Mention } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call Groq chat completions with retry on rate-limit (429) errors.
 * Honors the `retry-after` header when present, otherwise backs off
 * exponentially. Gives up after `maxRetries` and lets the caller fall back.
 */
async function chatWithRetry(content: string, maxRetries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 1024,
        temperature: 0.1,
        messages: [
          { role: "system", content: ANALYST_SYSTEM_PROMPT },
          { role: "user", content },
        ],
      });
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status !== 429 || attempt >= maxRetries) throw err;
      const retryAfter = Number(err?.headers?.["retry-after"]);
      const waitMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(2000 * 2 ** attempt, 15000);
      console.warn(`[analyzer] 429 rate-limited; retrying in ${waitMs}ms (attempt ${attempt + 1})`);
      await sleep(waitMs);
    }
  }
}

interface GroqMention {
  name: string;
  ticker: string | null;
  type: string;
  sentiment: string;
  signal: string;
  signal_strength: number;
  reasoning: string;
  time_horizon: string;
}

interface GroqResponse {
  mentions: GroqMention[];
  macro_theme?: string | null;
  affected_regions?: string[];
  statement_summary?: string;
}

export async function analyzeStatement(
  title: string,
  summary: string
): Promise<AnalysisResult> {
  const content = `Headline: ${title}\n\nContext: ${summary.substring(0, 400)}`;

  try {
    const completion = await chatWithRetry(content);

    const text = completion.choices[0]?.message?.content?.trim() ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[analyzer] No JSON found in response:", text.slice(0, 200));
      return empty(title);
    }

    const parsed: GroqResponse = JSON.parse(jsonMatch[0]);

    const cleanTicker = (t: string | null): string | undefined => {
      if (!t) return undefined;
      const u = t.trim().toUpperCase();
      return !u || ["NULL", "NONE", "N/A", "-"].includes(u) ? undefined : u;
    };

    const mentions: Mention[] = (parsed.mentions ?? []).map((m) => ({
      id: "",
      statementId: "",
      name: m.name,
      ticker: cleanTicker(m.ticker),
      type: (m.type as any) ?? "stock",
      sentiment: (m.sentiment as any) ?? "neutral",
      signal: (m.signal as any) ?? "WATCH",
      signalStrength: m.signal_strength ?? 3,
      reasoning: m.reasoning ?? "",
      timeHorizon: (m.time_horizon as any) ?? "short",
      quotePrice: undefined,
      quoteDayChange: undefined,
      quoteUpdatedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return {
      mentions,
      macroTheme: parsed.macro_theme ?? undefined,
      affectedRegions: parsed.affected_regions ?? [],
      statementSummary: parsed.statement_summary ?? title,
    };
  } catch (error) {
    console.error("[analyzer] Error:", error);
    return empty(title);
  }
}

function empty(title: string): AnalysisResult {
  return { mentions: [], macroTheme: undefined, affectedRegions: [], statementSummary: title };
}

export async function analyzeBatch(
  statements: Array<{ title: string; summary: string }>,
  maxItems = 20
): Promise<Array<{ title: string; summary: string; analysis: AnalysisResult }>> {
  const results = [];
  for (const stmt of statements.slice(0, maxItems)) {
    const analysis = await analyzeStatement(stmt.title, stmt.summary);
    results.push({ ...stmt, analysis });
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
