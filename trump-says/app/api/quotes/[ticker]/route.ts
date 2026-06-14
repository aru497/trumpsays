import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/quotes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    if (!ticker) {
      return NextResponse.json(
        { error: "Ticker is required" },
        { status: 400 }
      );
    }

    const quote = await getQuote(ticker);

    if (!quote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ticker: quote.ticker,
      price: quote.price,
      dayChangePct: quote.dayChangePct,
      weekChangePct: quote.weekChangePct,
      marketCap: quote.marketCap,
      fetchedAt: quote.fetchedAt,
    });
  } catch (error) {
    console.error("[/api/quotes] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
