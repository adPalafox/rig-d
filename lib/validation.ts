import {
  LIVE_COMMAND_DEFINITIONS,
  OPENING_STYLE_OPTIONS,
  PRESSURE_RULE_OPTIONS,
  RISK_LEVEL_OPTIONS,
} from "@/lib/content";
import { LiveCommandId, SetupPlan } from "@/lib/types";

const openingStyleSet = new Set<string>(OPENING_STYLE_OPTIONS.map((option) => option.id));
const pressureRuleSet = new Set<string>(PRESSURE_RULE_OPTIONS.map((option) => option.id));
const riskLevelSet = new Set<string>(RISK_LEVEL_OPTIONS.map((option) => option.id));
const liveCommandSet = new Set<string>(LIVE_COMMAND_DEFINITIONS.map((command) => command.id));

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

export function parseSetupPlan(value: unknown): SetupPlan {
  if (!value || typeof value !== "object") {
    throw new Error("Missing setup payload.");
  }

  const payload = value as Record<string, unknown>;
  const openingStyle = String(payload.openingStyle ?? "").trim();
  const pressureRule = String(payload.pressureRule ?? "").trim();
  const riskLevel = String(payload.riskLevel ?? "").trim();
  const signatureLine = String(payload.signatureLine ?? "").trim();

  if (!openingStyleSet.has(openingStyle)) {
    throw new Error("Pick an opening style.");
  }
  if (!pressureRuleSet.has(pressureRule)) {
    throw new Error("Pick a pressure rule.");
  }
  if (!riskLevelSet.has(riskLevel)) {
    throw new Error("Pick a risk level.");
  }
  if (signatureLine.length > 64) {
    throw new Error("Keep the signature line under 64 characters.");
  }

  return {
    openingStyle: openingStyle as SetupPlan["openingStyle"],
    pressureRule: pressureRule as SetupPlan["pressureRule"],
    riskLevel: riskLevel as SetupPlan["riskLevel"],
    signatureLine: signatureLine || undefined,
  };
}

export function parseLiveCommand(value: unknown) {
  const commandId = String((value as { commandId?: string } | null)?.commandId ?? "").trim();
  if (!liveCommandSet.has(commandId as LiveCommandId)) {
    throw new Error("Invalid live command.");
  }
  return commandId as LiveCommandId;
}
