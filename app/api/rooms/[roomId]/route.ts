import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { buildSnapshot } from "@/lib/store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();
    const origin = await getOrigin(request);
    return NextResponse.json(await buildSnapshot(roomId, viewerId, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Room not found." },
      { status: 404 },
    );
  }
}
