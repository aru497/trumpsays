export interface RawStatement {
  title: string;
  summary: string;
  link: string;
  published: string;
  source: string;
}

export interface Quote {
  ticker: string;
  price: number;
  dayChangePct: number;
  weekChangePct?: number;
  marketCap?: number;
  currency: string;
  fetchedAt: Date;
}

export interface Mention {
  id: string;
  statementId: string;
  name: string;
  ticker?: string;
  type: "stock" | "etf" | "sector" | "country_market" | "currency" | "commodity";
  sentiment: "bullish" | "bearish" | "neutral" | "mixed";
  signal: "BUY" | "SELL" | "WATCH" | "AVOID";
  signalStrength: number;
  reasoning: string;
  timeHorizon: "short" | "medium" | "long";
  quotePrice?: number;
  basePrice?: number;
  quoteDayChange?: number; // % change since the statement was published
  dayChangePct?: number; // today's daily % move
  quoteUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Analysis {
  id: string;
  statementId: string;
  statementSummary: string;
  macroTheme?: string;
  affectedRegions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Statement {
  id: string;
  title: string;
  summary: string;
  link: string;
  published: Date;
  source: string;
  analysis?: Analysis;
  mentions?: Mention[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisResult {
  mentions: Mention[];
  macroTheme?: string;
  affectedRegions?: string[];
  statementSummary?: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface PollingResult {
  articlesProcessed: number;
  mentionsFound: number;
  statementsCreated: number;
  duration: number;
}
