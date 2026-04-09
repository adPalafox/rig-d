import { cookies } from "next/headers";

export const PLAYER_COOKIE = "rigd_player_id";

export async function getViewerId() {
  const cookieStore = await cookies();
  return cookieStore.get(PLAYER_COOKIE)?.value ?? null;
}
