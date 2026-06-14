import { NextRequest, NextResponse } from "next/server";

// Allow up to 60s so a backfill run can analyse a batch of statements.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { runPollingJob, isCurrentlyPolling } = await import("@/lib/jobs/polling");
    // Verify the request is from Vercel
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In production with Vercel, they will send their own header
      // For now, we'll log but not fail
      console.warn("[/api/cron] Invalid authorization header");
    }

    if (isCurrentlyPolling()) {
      return NextResponse.json({
        success: false,
        message: "Polling already in progress",
      });
    }

    // Optional historical backfill: /api/cron?backfill=15
    const backfillParam = request.nextUrl.searchParams.get("backfill");
    const backfillDays = backfillParam ? parseInt(backfillParam, 10) : undefined;

    const result = await runPollingJob(
      backfillDays && backfillDays > 0 ? { backfillDays } : {}
    );

    return NextResponse.json({
      success: true,
      message: "Polling completed",
      ...result,
    });
  } catch (error) {
    console.error("[/api/cron] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Polling failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Allow manual triggering
  return GET(request);
}
