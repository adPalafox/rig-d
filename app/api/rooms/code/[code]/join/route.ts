import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/http";
import { PLAYER_COOKIE } from "@/lib/session";
import { createPlayer, getPlayer, joinRoomByCode } from "@/lib/store";
import { requireName } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as { playerName?: string };
    const name = requireName(body.playerName);
    const cookieStore = await cookies();
    const existingId = cookieStore.get(PLAYER_COOKIE)?.value;
    const player = getPlayer(existingId) ?? createPlayer(name);
    const origin = await getOrigin(request);
    const snapshot = await joinRoomByCode(code, player.id, origin);
    const response = NextResponse.json(snapshot);
    response.cookies.set(PLAYER_COOKIE, player.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to join room." },
      { status: 400 },
    );
  }
}
