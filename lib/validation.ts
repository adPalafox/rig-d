import { CoachingInput } from "@/lib/types";

export function requireName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 2) {
    throw new Error("Pick a name with at least 2 characters.");
  }
  if (name.length > 24) {
    throw new Error("Keep your name under 24 characters.");
  }
  return name;
}

export function parseCoaching(value: unknown): CoachingInput {
  if (!value || typeof value !== "object") {
    throw new Error("Missing coaching payload.");
  }
  const payload = value as Record<string, unknown>;
  const gamePlan = String(payload.gamePlan ?? "").trim();
  const tone = String(payload.tone ?? "").trim();
  const whenAttacked = String(payload.whenAttacked ?? "").trim();
  const avoidThisMistake = String(payload.avoidThisMistake ?? "").trim();
  const secretNote = String(payload.secretNote ?? "").trim();

  if (!gamePlan || !tone || !whenAttacked || !avoidThisMistake) {
    throw new Error("All coaching fields except secret note are required.");
  }

  return {
    gamePlan,
    tone,
    whenAttacked,
    avoidThisMistake,
    secretNote: secretNote || undefined,
  };
}
