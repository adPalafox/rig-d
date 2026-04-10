import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { submitLiveCommand } from "@/lib/store";
import { parseLiveCommand } from "@/lib/validation";

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
    const commandId = parseLiveCommand(body);
    return NextResponse.json(await submitLiveCommand(matchId, viewerId, commandId, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to use live command." },
      { status: 400 },
    );
  }
}
