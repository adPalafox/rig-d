import test from "node:test";
import assert from "node:assert/strict";
import { AgentId, DebatePhase, SetupPlan } from "@/lib/types";
import {
  createPlayer,
  createRoom,
  getMatchSnapshot,
  joinRoomByCode,
  resetStore,
  setReady,
  submitLiveCommand,
  submitSetup,
} from "@/lib/store";

const ORIGIN = "http://localhost:3000";

function configureFastMatchTimers() {
  process.env.RIGD_SETUP_DURATION_MS = "40";
  process.env.RIGD_PHASE_DURATION_MS = "120";
  process.env.RIGD_REVEAL_DURATION_MS = "25";
}

function tailoredSetup(agentId: AgentId): SetupPlan {
  if (agentId === "Bruiser") {
    return {
      openingStyle: "fast_start",
      pressureRule: "trade_shots",
      riskLevel: "pressing",
      signatureLine: "Break the stance before it breathes.",
    };
  }
  if (agentId === "Gremlin") {
    return {
      openingStyle: "needle",
      pressureRule: "counter_first",
      riskLevel: "pressing",
      signatureLine: "Annoy them from one ugly angle.",
    };
  }
  if (agentId === "Scholar") {
    return {
      openingStyle: "measured",
      pressureRule: "stay_grounded",
      riskLevel: "composed",
      signatureLine: "Make every step look smarter than theirs.",
    };
  }
  return {
    openingStyle: "showboat",
    pressureRule: "trade_shots",
    riskLevel: "all_in",
    signatureLine: "If the crowd gasps, keep going.",
  };
}

function sloppySetup(): SetupPlan {
  return {
    openingStyle: "showboat",
    pressureRule: "trade_shots",
    riskLevel: "all_in",
    signatureLine: "Just be loud.",
  };
}

function strongCommand(agentId: AgentId, phase: DebatePhase) {
  if (agentId === "Bruiser") {
    return phase === "closing" ? ("go_for_the_bell" as const) : ("rush_in" as const);
  }
  if (agentId === "Gremlin") {
    return phase === "rebuttal" ? ("slip_counter" as const) : ("stick_the_jab" as const);
  }
  if (agentId === "Scholar") {
    return phase === "opening" ? ("plant_your_feet" as const) : ("slip_counter" as const);
  }
  return phase === "closing" ? ("go_for_the_bell" as const) : ("showboat" as const);
}

function weakCommand(agentId: AgentId) {
  if (agentId === "Bruiser") return "showboat" as const;
  if (agentId === "Gremlin") return "cover_up" as const;
  if (agentId === "Scholar") return "rush_in" as const;
  return "back_off" as const;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPhase(matchId: string, playerId: string, phase: DebatePhase) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const snapshot = await getMatchSnapshot(matchId, playerId, ORIGIN);
    if (snapshot.match.currentPhase === phase && snapshot.match.state === "live_phase_open") {
      return snapshot;
    }
    if (snapshot.match.state === "reveal_ready" || snapshot.match.state === "completed") {
      return snapshot;
    }
    await wait(25);
  }
  return getMatchSnapshot(matchId, playerId, ORIGIN);
}

async function waitForReveal(matchId: string, playerId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const snapshot = await getMatchSnapshot(matchId, playerId, ORIGIN);
    if (snapshot.match.state === "reveal_ready" || snapshot.match.state === "completed") {
      return snapshot;
    }
    await wait(25);
  }
  return getMatchSnapshot(matchId, playerId, ORIGIN);
}

test("full match flows from room creation through arena beats to reveal", async () => {
  resetStore();
  configureFastMatchTimers();

  const alpha = createPlayer("Alpha");
  const bravo = createPlayer("Bravo");
  const roomSnapshot = await createRoom(alpha.id, ORIGIN);
  const joined = await joinRoomByCode(roomSnapshot.room.code, bravo.id, ORIGIN);

  await setReady(joined.match.id, alpha.id, ORIGIN);
  const afterReadyTwo = await setReady(joined.match.id, bravo.id, ORIGIN);
  assert.equal(afterReadyTwo.match.state, "setup_open");

  const alphaAgent = afterReadyTwo.players.find((player) => player.id === alpha.id)?.agent?.id!;
  const bravoAgent = afterReadyTwo.players.find((player) => player.id === bravo.id)?.agent?.id!;

  await submitSetup(afterReadyTwo.match.id, alpha.id, tailoredSetup(alphaAgent), ORIGIN);
  const liveOpening = await submitSetup(afterReadyTwo.match.id, bravo.id, tailoredSetup(bravoAgent), ORIGIN);
  assert.equal(liveOpening.match.state, "live_phase_open");

  await submitLiveCommand(liveOpening.match.id, alpha.id, strongCommand(alphaAgent, "opening"), ORIGIN);
  await submitLiveCommand(liveOpening.match.id, bravo.id, strongCommand(bravoAgent, "opening"), ORIGIN);

  const rebuttal = await waitForPhase(liveOpening.match.id, alpha.id, "rebuttal");
  await submitLiveCommand(rebuttal.match.id, alpha.id, strongCommand(alphaAgent, "rebuttal"), ORIGIN);
  await submitLiveCommand(rebuttal.match.id, bravo.id, strongCommand(bravoAgent, "rebuttal"), ORIGIN);

  const closing = await waitForPhase(liveOpening.match.id, alpha.id, "closing");
  await submitLiveCommand(closing.match.id, alpha.id, strongCommand(alphaAgent, "closing"), ORIGIN);
  await submitLiveCommand(closing.match.id, bravo.id, strongCommand(bravoAgent, "closing"), ORIGIN);

  const finalSnapshot = await waitForReveal(liveOpening.match.id, alpha.id);
  assert.ok(["reveal_ready", "completed"].includes(finalSnapshot.match.state));
  assert.ok(finalSnapshot.judgeResult);
  assert.equal(finalSnapshot.turnLog.length, 6);
  assert.ok(finalSnapshot.arenaTimeline.length >= 6);
  assert.ok(finalSnapshot.judgeResult?.decisiveMoment);
});

test("commands immediately create arena beats and alter visible fighter state", async () => {
  resetStore();
  configureFastMatchTimers();

  const alpha = createPlayer("Coach Prime");
  const bravo = createPlayer("Coach Loose");
  const roomSnapshot = await createRoom(alpha.id, ORIGIN);
  const joined = await joinRoomByCode(roomSnapshot.room.code, bravo.id, ORIGIN);
  await setReady(joined.match.id, alpha.id, ORIGIN);
  const setupOpen = await setReady(joined.match.id, bravo.id, ORIGIN);

  const alphaAgent = setupOpen.players.find((player) => player.id === alpha.id)?.agent?.id!;
  const bravoAgent = setupOpen.players.find((player) => player.id === bravo.id)?.agent?.id!;

  await submitSetup(setupOpen.match.id, alpha.id, tailoredSetup(alphaAgent), ORIGIN);
  const opening = await submitSetup(setupOpen.match.id, bravo.id, sloppySetup(), ORIGIN);

  const afterAlpha = await submitLiveCommand(opening.match.id, alpha.id, strongCommand(alphaAgent, "opening"), ORIGIN);
  const alphaView = afterAlpha.players.find((player) => player.id === alpha.id)!;
  const opponentView = afterAlpha.players.find((player) => player.id === bravo.id)!;
  assert.ok(afterAlpha.arenaTimeline.length >= 1);
  assert.notEqual(alphaView.fighterAction, "idle");
  assert.notEqual(alphaView.ringPosition, 0);
  assert.notEqual(opponentView.staggerLevel, 0);

  const finalAfterBeat = await submitLiveCommand(opening.match.id, bravo.id, weakCommand(bravoAgent), ORIGIN);
  assert.ok(finalAfterBeat.arenaTimeline.length >= 2);
  assert.notEqual(finalAfterBeat.players.find((player) => player.id === bravo.id)!.fighterState, "guarded");
});

test("corner energy still gates spam and command ids map to the boxing-first surface", async () => {
  resetStore();
  configureFastMatchTimers();

  const alpha = createPlayer("Energy Tester");
  const bravo = createPlayer("Foil");
  const roomSnapshot = await createRoom(alpha.id, ORIGIN);
  const joined = await joinRoomByCode(roomSnapshot.room.code, bravo.id, ORIGIN);
  await setReady(joined.match.id, alpha.id, ORIGIN);
  const setupOpen = await setReady(joined.match.id, bravo.id, ORIGIN);

  const alphaAgent = setupOpen.players.find((player) => player.id === alpha.id)?.agent?.id!;
  const bravoAgent = setupOpen.players.find((player) => player.id === bravo.id)?.agent?.id!;

  await submitSetup(setupOpen.match.id, alpha.id, tailoredSetup(alphaAgent), ORIGIN);
  const opening = await submitSetup(setupOpen.match.id, bravo.id, tailoredSetup(bravoAgent), ORIGIN);

  await submitLiveCommand(opening.match.id, alpha.id, "rush_in", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "back_off", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "slip_counter", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "cover_up", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "rush_in", ORIGIN);

  await assert.rejects(
    submitLiveCommand(opening.match.id, alpha.id, "rush_in", ORIGIN),
    /Not enough corner energy/,
  );

  const snapshot = await getMatchSnapshot(opening.match.id, alpha.id, ORIGIN);
  const alphaView = snapshot.players.find((player) => player.id === alpha.id)!;
  assert.equal(alphaView.cornerEnergy, 0);
  assert.equal(snapshot.commandFeed.filter((command) => command.playerId === alpha.id).length, 5);
  assert.equal(snapshot.commandFeed[0]?.commandId.includes("_"), true);
});
