import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { db } = await import("@/lib/db");
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const signal = searchParams.get("signal");
    const sentiment = searchParams.get("sentiment");
    const ticker = searchParams.get("ticker");

    // Build where clause
    const where: any = {};
    if (signal) where.signal = signal;
    if (sentiment) where.sentiment = sentiment;
    if (ticker) where.ticker = ticker.toUpperCase();

    // Get total count
    const total = await db.mention.count({ where });

    // Fetch mentions
    const mentions = await db.mention.findMany({
      where,
      include: {
        statement: {
          select: {
            title: true,
            published: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      mentions: mentions.map((m: any) => ({
        id: m.id,
        company: m.name,
        ticker: m.ticker,
        signal: m.signal,
        sentiment: m.sentiment,
        signalStrength: m.signalStrength,
        price: m.quotePrice,
        dayChange: m.quoteDayChange,
        latestStatement: m.statement?.title,
        latestPublished: m.statement?.published,
      })),
      total,
      hasMore: offset + limit < total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[/api/mentions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}
