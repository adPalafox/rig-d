import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { startRematch } from "@/lib/store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const origin = await getOrigin(request);
    return NextResponse.json(startRematch(roomId, origin));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to start rematch." },
      { status: 400 },
    );
  }
}
