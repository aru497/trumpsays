import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const upper = decodeURIComponent(ticker).toUpperCase();

    const { db } = await import("@/lib/db");

    const mentions = await db.mention.findMany({
      where: { ticker: upper },
      include: {
        statement: {
          select: { title: true, published: true, link: true, source: true },
        },
      },
      orderBy: { statement: { published: "desc" } },
    });

    if (mentions.length === 0) {
      return NextResponse.json(
        { ticker: upper, name: upper, mentions: [], series: [] },
        { status: 200 }
      );
    }

    const name = mentions[0].name;
    const firstPublished = mentions.reduce(
      (min, m) => (m.statement.published < min ? m.statement.published : min),
      mentions[0].statement.published
    );

    const { getPriceSeries } = await import("@/lib/quotes");
    const series = await getPriceSeries(upper, firstPublished);

    return NextResponse.json({
      ticker: upper,
      name,
      series,
      mentions: mentions.map((m) => ({
        id: m.id,
        title: m.statement.title,
        link: m.statement.link,
        source: m.statement.source,
        published: m.statement.published,
        signal: m.signal,
        sentiment: m.sentiment,
        signalStrength: m.signalStrength,
        reasoning: m.reasoning,
        basePrice: m.basePrice,
        quotePrice: m.quotePrice,
        quoteDayChange: m.quoteDayChange,
      })),
    });
  } catch (error) {
    console.error("[/api/stock] Error:", error);
    return NextResponse.json({ error: "Failed to load stock" }, { status: 500 });
  }
}
