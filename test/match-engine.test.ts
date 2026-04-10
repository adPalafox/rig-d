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
      signatureLine: "Hit the same lane until it breaks.",
    };
  }
  if (agentId === "Gremlin") {
    return {
      openingStyle: "needle",
      pressureRule: "stay_grounded",
      riskLevel: "pressing",
      signatureLine: "One image. Keep chewing it.",
    };
  }
  if (agentId === "Scholar") {
    return {
      openingStyle: "measured",
      pressureRule: "reset_frame",
      riskLevel: "composed",
      signatureLine: "Make them answer the structure, not the noise.",
    };
  }
  return {
    openingStyle: "showboat",
    pressureRule: "stay_grounded",
    riskLevel: "all_in",
    signatureLine: "Make the room remember the close.",
  };
}

function sloppySetup(): SetupPlan {
  return {
    openingStyle: "showboat",
    pressureRule: "trade_shots",
    riskLevel: "all_in",
    signatureLine: "Just make it loud.",
  };
}

function strongCommand(agentId: AgentId, phase: DebatePhase) {
  if (agentId === "Bruiser") {
    return phase === "rebuttal" ? ("stay_tight" as const) : ("push" as const);
  }
  if (agentId === "Gremlin") {
    return phase === "rebuttal" ? ("counter" as const) : ("one_example" as const);
  }
  if (agentId === "Scholar") {
    if (phase === "opening") return "ground_it" as const;
    return phase === "rebuttal" ? ("counter" as const) : ("reset" as const);
  }
  if (phase === "opening") return "crowd_pleaser" as const;
  return phase === "rebuttal" ? ("push" as const) : ("stay_tight" as const);
}

function weakCommand(agentId: AgentId) {
  if (agentId === "Bruiser") return "crowd_pleaser" as const;
  if (agentId === "Gremlin") return "stay_tight" as const;
  if (agentId === "Scholar") return "push" as const;
  return "stay_tight" as const;
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

test("full match flows from room creation through live corner phases to reveal", async () => {
  resetStore();
  configureFastMatchTimers();

  const alpha = createPlayer("Alpha");
  const bravo = createPlayer("Bravo");
  const roomSnapshot = await createRoom(alpha.id, ORIGIN);
  const joined = await joinRoomByCode(roomSnapshot.room.code, bravo.id, ORIGIN);

  assert.equal(joined.players.length, 2);

  await setReady(joined.match.id, alpha.id, ORIGIN);
  const afterReadyTwo = await setReady(joined.match.id, bravo.id, ORIGIN);
  assert.equal(afterReadyTwo.match.state, "setup_open");

  const alphaAgent = afterReadyTwo.players.find((player) => player.id === alpha.id)?.agent?.id;
  const bravoAgent = afterReadyTwo.players.find((player) => player.id === bravo.id)?.agent?.id;
  assert.ok(alphaAgent);
  assert.ok(bravoAgent);

  await submitSetup(afterReadyTwo.match.id, alpha.id, tailoredSetup(alphaAgent!), ORIGIN);
  const liveOpening = await submitSetup(afterReadyTwo.match.id, bravo.id, tailoredSetup(bravoAgent!), ORIGIN);
  assert.equal(liveOpening.match.state, "live_phase_open");
  assert.equal(liveOpening.match.currentPhase, "opening");

  await submitLiveCommand(liveOpening.match.id, alpha.id, strongCommand(alphaAgent!, "opening"), ORIGIN);
  await submitLiveCommand(liveOpening.match.id, bravo.id, strongCommand(bravoAgent!, "opening"), ORIGIN);

  const rebuttal = await waitForPhase(liveOpening.match.id, alpha.id, "rebuttal");
  assert.equal(rebuttal.match.currentPhase, "rebuttal");
  await submitLiveCommand(rebuttal.match.id, alpha.id, strongCommand(alphaAgent!, "rebuttal"), ORIGIN);
  await submitLiveCommand(rebuttal.match.id, bravo.id, strongCommand(bravoAgent!, "rebuttal"), ORIGIN);

  const closing = await waitForPhase(liveOpening.match.id, alpha.id, "closing");
  assert.equal(closing.match.currentPhase, "closing");
  await submitLiveCommand(closing.match.id, alpha.id, strongCommand(alphaAgent!, "closing"), ORIGIN);
  await submitLiveCommand(closing.match.id, bravo.id, strongCommand(bravoAgent!, "closing"), ORIGIN);

  const finalSnapshot = await waitForReveal(liveOpening.match.id, alpha.id);
  assert.ok(["reveal_ready", "completed"].includes(finalSnapshot.match.state));
  assert.ok(finalSnapshot.judgeResult);
  assert.equal(finalSnapshot.turnLog.length, 6);
  assert.ok(finalSnapshot.commandFeed.length >= 6);
  assert.ok(finalSnapshot.judgeResult?.decisiveMoment);
});

test("live corner commands shift performance beyond setup and expose decisive moments", async () => {
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

  await submitLiveCommand(opening.match.id, alpha.id, strongCommand(alphaAgent, "opening"), ORIGIN);
  await submitLiveCommand(opening.match.id, bravo.id, weakCommand(bravoAgent), ORIGIN);

  const rebuttal = await waitForPhase(opening.match.id, alpha.id, "rebuttal");
  await submitLiveCommand(rebuttal.match.id, alpha.id, strongCommand(alphaAgent, "rebuttal"), ORIGIN);
  await submitLiveCommand(rebuttal.match.id, bravo.id, weakCommand(bravoAgent), ORIGIN);

  const closing = await waitForPhase(opening.match.id, alpha.id, "closing");
  await submitLiveCommand(closing.match.id, alpha.id, strongCommand(alphaAgent, "closing"), ORIGIN);
  await submitLiveCommand(closing.match.id, bravo.id, weakCommand(bravoAgent), ORIGIN);

  const finalSnapshot = await waitForReveal(opening.match.id, alpha.id);
  const alphaResult = finalSnapshot.players.find((player) => player.id === alpha.id)!;
  const bravoResult = finalSnapshot.players.find((player) => player.id === bravo.id)!;

  assert.ok((alphaResult.actualScore ?? 0) !== (bravoResult.actualScore ?? 0));
  assert.ok(finalSnapshot.judgeResult?.decisiveMoment?.commands.length);
  assert.match(finalSnapshot.judgeResult?.coachingImpactSummary ?? "", /coaching swing/i);
});

test("corner energy prevents meaningless spam and keeps command feed readable", async () => {
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

  await submitLiveCommand(opening.match.id, alpha.id, "push", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "reset", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "counter", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "stay_tight", ORIGIN);
  await submitLiveCommand(opening.match.id, alpha.id, "push", ORIGIN);

  await assert.rejects(
    submitLiveCommand(opening.match.id, alpha.id, "push", ORIGIN),
    /Not enough corner energy/,
  );

  const snapshot = await getMatchSnapshot(opening.match.id, alpha.id, ORIGIN);
  const alphaView = snapshot.players.find((player) => player.id === alpha.id)!;
  assert.equal(alphaView.cornerEnergy, 0);
  assert.equal(snapshot.commandFeed.filter((command) => command.playerId === alpha.id).length, 5);
});
