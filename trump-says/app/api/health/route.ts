import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Lazy load db
    const { db } = await import("@/lib/db");

    // Check database connection
    await db.statement.count();

    // Get last polling time
    const lastPolling = await db.pollingLog.findFirst({
      orderBy: { createdAt: "desc" },
    });

    // Count mentions
    const mentionCount = await db.mention.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      lastPolledAt: lastPolling?.createdAt || null,
      lastPollingDuration: lastPolling?.duration || null,
      mentionCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
