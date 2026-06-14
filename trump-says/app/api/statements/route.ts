import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { db } = await import("@/lib/db");
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sentiment = searchParams.get("sentiment");
    const signal = searchParams.get("signal");
    const ticker = searchParams.get("ticker");
    const sortBy = searchParams.get("sortBy") || "published";

    // Only surface statements that actually have company mentions. We persist
    // analyzed-but-empty statements (for dedup/cursor tracking), but they
    // should never appear in the feed.
    const where: any = { mentions: { some: {} } };
    if (sentiment) where.mentions.some.sentiment = sentiment;
    if (signal) where.mentions.some.signal = signal;
    if (ticker) where.mentions.some.ticker = ticker.toUpperCase();

    // Get total count
    const total = await db.statement.count({ where });

    // Fetch statements with pagination
    const statements = await db.statement.findMany({
      where,
      include: {
        analysis: true,
        mentions: true,
      },
      orderBy: {
        [sortBy === "created" ? "createdAt" : "published"]: "desc",
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      statements: statements.map((stmt: any) => ({
        id: stmt.id,
        title: stmt.title,
        summary: stmt.summary,
        link: stmt.link,
        published: stmt.published,
        source: stmt.source,
        mentions: stmt.mentions,
        analysis: stmt.analysis,
      })),
      total,
      hasMore: offset + limit < total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[/api/statements] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statements" },
      { status: 500 }
    );
  }
}
