import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { setReady } from "@/lib/store";

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
    return NextResponse.json(await setReady(matchId, viewerId, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to mark ready." },
      { status: 400 },
    );
  }
}
