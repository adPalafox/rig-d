import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { getReplay } from "@/lib/store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await context.params;
    const viewerId = await getViewerId();
    const origin = await getOrigin(request);
    return NextResponse.json(await getReplay(matchId, viewerId, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Replay unavailable." },
      { status: 400 },
    );
  }
}
