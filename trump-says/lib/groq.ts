import Groq from "groq-sdk";

let _groq: Groq | null = null;

export function getGroq(): Groq {
  if (_groq) return _groq;
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// Lazy proxy so `import { groq }` keeps working without connecting at module load.
export const groq = new Proxy({} as Groq, {
  get(_t, prop) {
    return (getGroq() as any)[prop];
  },
});

/**
 * Model used for statement analysis. Configurable via GROQ_MODEL so it can be
 * swapped (e.g. to "groq/compound") without a code change.
 *
 * Default: meta-llama/llama-4-scout-17b-16e-instruct
 *   RPM 30 · RPD 1K · TPM 30K · TPD 500K — generous headroom for our cadence.
 */
export const GROQ_MODEL =
  process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

export const ANALYST_SYSTEM_PROMPT = `You are a financial analyst specializing in political risk and market impacts.
Given a news headline or statement about Trump, extract ONLY companies or stocks he directly mentions by name (not inferred).

Return a JSON object with this exact structure (no markdown, no code fences, raw JSON only):
{
  "mentions": [
    {
      "name": "Full company name",
      "ticker": "TICKER or null",
      "type": "stock|etf|sector|country_market|currency|commodity",
      "sentiment": "bullish|bearish|neutral|mixed",
      "signal": "BUY|SELL|WATCH|AVOID",
      "signal_strength": 1,
      "reasoning": "Brief explanation (max 100 words)",
      "time_horizon": "short|medium|long"
    }
  ],
  "macro_theme": "tariffs|trade_deal|sanctions|regulations|tax|deregulation|other|null",
  "affected_regions": ["US"],
  "statement_summary": "One sentence summary"
}

Rules:
- Only direct name mentions, not inferred ones
- signal_strength: 1=weak, 5=strong
- time_horizon: short=0-3 months, medium=3-12 months, long=12+ months
- If no company is directly named, return {"mentions":[],"macro_theme":null,"affected_regions":[],"statement_summary":"..."}
- Return ONLY raw JSON, no explanation, no markdown`;
