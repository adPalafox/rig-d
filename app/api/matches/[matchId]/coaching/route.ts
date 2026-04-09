import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { submitCoaching } from "@/lib/store";
import { parseCoaching } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    const viewerId = await getViewerId();
    if (!viewerId) {
      throw new Error("Missing player session.");
    }
    const { matchId } = await context.params;
    const origin = await getOrigin(request);
    const body = await request.json();
    const coaching = parseCoaching(body);
    return NextResponse.json(submitCoaching(matchId, viewerId, coaching, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to submit coaching." },
      { status: 400 },
    );
  }
}
