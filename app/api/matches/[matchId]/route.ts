import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { getMatchSnapshot } from "@/lib/store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await context.params;
    const viewerId = await getViewerId();
    const origin = await getOrigin(request);
    return NextResponse.json(await getMatchSnapshot(matchId, viewerId, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Match not found." },
      { status: 404 },
    );
  }
}
