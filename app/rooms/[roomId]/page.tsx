import { notFound } from "next/navigation";
import { RoomClient } from "@/components/RoomClient";
import { getOrigin } from "@/lib/http";
import { getViewerId } from "@/lib/session";
import { buildSnapshot } from "@/lib/store";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const viewerId = await getViewerId();
  const origin = await getOrigin();

  try {
    const snapshot = buildSnapshot(roomId, viewerId, origin);
    return <RoomClient initialSnapshot={snapshot} />;
  } catch {
    notFound();
  }
}
