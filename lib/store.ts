import {
  AGENT_DEFINITIONS,
  DEBATE_TOPICS,
  LIVE_COMMAND_DEFINITIONS,
  getAgentDefinition,
  getLiveCommandDefinition,
} from "@/lib/content";
import {
  ArenaBeat,
  DebatePhase,
  FighterAction,
  FighterState,
  ImpactType,
  JudgeResult,
  LiveCommandId,
  MatchCommand,
  MatchEvent,
  MatchSnapshot,
  MatchState,
  MatchTurn,
  MomentumPoint,
  SetupPlan,
} from "@/lib/types";
import { clamp, randomId, roomCode, scoreLabel, shuffle } from "@/lib/utils";

const ENERGY_CAP = 5;
const ENERGY_REGEN_MS = 1_000;
const PHASES: DebatePhase[] = ["opening", "rebuttal", "closing"];

function getSetupDurationMs() {
  return Number(process.env.RIGD_SETUP_DURATION_MS ?? 18_000);
}

function getPhaseDurationMs() {
  return Number(process.env.RIGD_PHASE_DURATION_MS ?? 8_000);
}

function getRevealDurationMs() {
  return Number(process.env.RIGD_REVEAL_DURATION_MS ?? 5_000);
}

type PlayerRecord = {
  id: string;
  name: string;
  createdAt: number;
};

type RoomPlayerRecord = {
  roomId: string;
  playerId: string;
  joinedAt: number;
  lastSeenAt: number;
};

type RivalryRecord = {
  roundsPlayed: number;
  currentStreakPlayerId: string | null;
  currentStreakCount: number;
  winsByPlayer: Record<string, number>;
};

type AgentAssignmentRecord = {
  id: (typeof AGENT_DEFINITIONS)[number]["id"];
  expectedScore: number;
  actualScore: number | null;
  rigScore: number | null;
  rigLabel: string | null;
};

type MatchPlayerRecord = {
  playerId: string;
  readyAt: number | null;
  setupPlan: SetupPlan | null;
  setupSubmittedAt: number | null;
  disconnectedSince: number | null;
  agent: AgentAssignmentRecord | null;
  cornerEnergy: number;
  lastEnergyTickAt: number;
  lastCommandAt: number | null;
  momentum: number;
  fighterState: FighterState;
  fighterAction: FighterAction;
  ringPosition: number;
  staggerLevel: number;
  hypeLevel: number;
  lastImpactType: ImpactType;
};

type RoomRecord = {
  id: string;
  code: string;
  createdAt: number;
  hostPlayerId: string;
  playerIds: string[];
  activeMatchId: string;
  rivalry: RivalryRecord;
};

type MatchRecord = {
  id: string;
  roomId: string;
  createdAt: number;
  updatedAt: number;
  state: MatchState;
  topic: (typeof DEBATE_TOPICS)[number];
  setupDeadlineAt: number | null;
  phaseDeadlineAt: number | null;
  currentPhase: DebatePhase | null;
  revealAt: number | null;
  currentBeat: number;
  players: MatchPlayerRecord[];
  turns: MatchTurn[];
  commands: MatchCommand[];
  momentumTimeline: MomentumPoint[];
  arenaTimeline: ArenaBeat[];
  judgeResult: JudgeResult | null;
  events: MatchEvent[];
  seriesRecorded: boolean;
};

type GlobalStore = {
  players: Map<string, PlayerRecord>;
  rooms: Map<string, RoomRecord>;
  roomPlayers: Map<string, RoomPlayerRecord>;
  matches: Map<string, MatchRecord>;
};

declare global {
  // eslint-disable-next-line no-var
  var __rigdStore__: GlobalStore | undefined;
}

function createStore(): GlobalStore {
  return {
    players: new Map(),
    rooms: new Map(),
    roomPlayers: new Map(),
    matches: new Map(),
  };
}

function getStore() {
  if (!globalThis.__rigdStore__) {
    globalThis.__rigdStore__ = createStore();
  }
  return globalThis.__rigdStore__;
}

function roomPlayerKey(roomId: string, playerId: string) {
  return `${roomId}:${playerId}`;
}

function addEvent(match: MatchRecord, type: MatchEvent["type"], message: string) {
  match.events.unshift({
    id: randomId("event"),
    type,
    message,
    createdAt: Date.now(),
  });
}

function heartbeat(roomId: string, playerId: string) {
  const record = getStore().roomPlayers.get(roomPlayerKey(roomId, playerId));
  if (record) {
    record.lastSeenAt = Date.now();
  }
}

function currentPlayerName(playerId: string) {
  return getStore().players.get(playerId)?.name ?? "Unknown";
}

function getOpponent(match: MatchRecord, playerId: string) {
  return match.players.find((player) => player.playerId !== playerId)!;
}

function makeDefaultFighterState(): Pick<
  MatchPlayerRecord,
  "momentum" | "fighterState" | "fighterAction" | "ringPosition" | "staggerLevel" | "hypeLevel" | "lastImpactType"
> {
  return {
    momentum: 0,
    fighterState: "guarded",
    fighterAction: "idle",
    ringPosition: 0,
    staggerLevel: 0,
    hypeLevel: 0,
    lastImpactType: "recovery",
  };
}

function assignAgents(match: MatchRecord) {
  const shuffled = shuffle(AGENT_DEFINITIONS).slice(0, 2);
  match.players.forEach((player, index) => {
    const agent = shuffled[index]!;
    player.agent = {
      id: agent.id,
      expectedScore: agent.baselineScore + match.topic.difficultyAdjustment,
      actualScore: null,
      rigScore: null,
      rigLabel: null,
    };
    Object.assign(player, makeDefaultFighterState());
  });
}

function refreshPlayerEnergy(player: MatchPlayerRecord, now = Date.now()) {
  const elapsedTicks = Math.floor((now - player.lastEnergyTickAt) / ENERGY_REGEN_MS);
  if (elapsedTicks <= 0) return;
  player.cornerEnergy = Math.min(ENERGY_CAP, player.cornerEnergy + elapsedTicks);
  player.lastEnergyTickAt += elapsedTicks * ENERGY_REGEN_MS;
}

function refreshAllEnergy(match: MatchRecord) {
  const now = Date.now();
  match.players.forEach((player) => refreshPlayerEnergy(player, now));
}

function startSetup(match: MatchRecord) {
  if (match.players.length !== 2 || !match.players.every((player) => player.readyAt)) return;
  if (!match.players.every((player) => player.agent)) {
    assignAgents(match);
  }
  match.state = "setup_open";
  match.setupDeadlineAt = Date.now() + getSetupDurationMs();
  match.updatedAt = Date.now();
  addEvent(match, "setup_started", "Corners are open. Get the fighter stance set before the bell.");
}

function startLivePhase(match: MatchRecord, phase: DebatePhase) {
  match.state = "live_phase_open";
  match.currentPhase = phase;
  match.phaseDeadlineAt = Date.now() + getPhaseDurationMs();
  match.updatedAt = Date.now();
  addEvent(match, "live_phase_started", `${phase[0]!.toUpperCase()}${phase.slice(1)} bell. Fighters are live.`);
}

function setupFitsAgent(agentId: AgentAssignmentRecord["id"], setup: SetupPlan | null) {
  if (!setup) return -6;

  const openingFit: Record<AgentAssignmentRecord["id"], Record<SetupPlan["openingStyle"], number>> = {
    Bruiser: { fast_start: 4, measured: 0, needle: 1, showboat: -1 },
    Gremlin: { fast_start: 1, measured: 0, needle: 4, showboat: 2 },
    Scholar: { fast_start: -1, measured: 4, needle: 2, showboat: -3 },
    Showman: { fast_start: 2, measured: 0, needle: 0, showboat: 4 },
  };
  const pressureFit: Record<AgentAssignmentRecord["id"], Record<SetupPlan["pressureRule"], number>> = {
    Bruiser: { counter_first: 0, reset_frame: -1, trade_shots: 4, stay_grounded: 1 },
    Gremlin: { counter_first: 2, reset_frame: 1, trade_shots: 0, stay_grounded: 2 },
    Scholar: { counter_first: 2, reset_frame: 4, trade_shots: -3, stay_grounded: 3 },
    Showman: { counter_first: 1, reset_frame: 0, trade_shots: 2, stay_grounded: 1 },
  };
  const riskFit: Record<AgentAssignmentRecord["id"], Record<SetupPlan["riskLevel"], number>> = {
    Bruiser: { composed: 0, pressing: 3, all_in: 1 },
    Gremlin: { composed: 0, pressing: 2, all_in: 2 },
    Scholar: { composed: 4, pressing: 1, all_in: -4 },
    Showman: { composed: -1, pressing: 2, all_in: 4 },
  };

  return Math.round(
    (openingFit[agentId][setup.openingStyle] +
      pressureFit[agentId][setup.pressureRule] +
      riskFit[agentId][setup.riskLevel] +
      (setup.signatureLine ? 1 : 0)) * getAgentDefinition(agentId).promptSensitivity,
  );
}

function getRepeatedCommandCount(match: MatchRecord, playerId: string, phase: DebatePhase, commandId: LiveCommandId) {
  return match.commands.filter(
    (command) => command.playerId === playerId && command.phase === phase && command.commandId === commandId,
  ).length;
}

function getCommandAgentFit(agentId: AgentAssignmentRecord["id"], commandId: LiveCommandId) {
  const fit: Record<AgentAssignmentRecord["id"], Record<LiveCommandId, number>> = {
    Bruiser: {
      rush_in: 3,
      back_off: -1,
      slip_counter: 1,
      cover_up: 0,
      showboat: -1,
      plant_your_feet: 2,
      stick_the_jab: 1,
      go_for_the_bell: 2,
    },
    Gremlin: {
      rush_in: 1,
      back_off: 0,
      slip_counter: 2,
      cover_up: -1,
      showboat: 2,
      plant_your_feet: 0,
      stick_the_jab: 3,
      go_for_the_bell: 1,
    },
    Scholar: {
      rush_in: -2,
      back_off: 1,
      slip_counter: 3,
      cover_up: 2,
      showboat: -3,
      plant_your_feet: 3,
      stick_the_jab: 1,
      go_for_the_bell: -2,
    },
    Showman: {
      rush_in: 1,
      back_off: -1,
      slip_counter: 1,
      cover_up: 0,
      showboat: 3,
      plant_your_feet: 1,
      stick_the_jab: 0,
      go_for_the_bell: 4,
    },
  };

  return fit[agentId][commandId];
}

function getCommandSetupFit(setup: SetupPlan | null, commandId: LiveCommandId, phase: DebatePhase) {
  if (!setup) return -1;
  let score = 0;

  const openingMatches: Record<SetupPlan["openingStyle"], LiveCommandId[]> = {
    fast_start: ["rush_in", "stick_the_jab"],
    measured: ["back_off", "plant_your_feet"],
    needle: ["slip_counter", "stick_the_jab"],
    showboat: ["showboat", "go_for_the_bell"],
  };
  const pressureMatches: Record<SetupPlan["pressureRule"], LiveCommandId[]> = {
    counter_first: ["slip_counter"],
    reset_frame: ["back_off", "plant_your_feet"],
    trade_shots: ["rush_in", "go_for_the_bell"],
    stay_grounded: ["cover_up", "plant_your_feet", "stick_the_jab"],
  };
  const riskMatches: Record<SetupPlan["riskLevel"], LiveCommandId[]> = {
    composed: ["back_off", "cover_up", "plant_your_feet"],
    pressing: ["rush_in", "slip_counter", "stick_the_jab"],
    all_in: ["showboat", "go_for_the_bell", "rush_in"],
  };

  if (openingMatches[setup.openingStyle].includes(commandId)) score += phase === "opening" ? 2 : 1;
  if (pressureMatches[setup.pressureRule].includes(commandId)) score += 2;
  if (riskMatches[setup.riskLevel].includes(commandId)) score += 1;
  if (phase !== "closing" && commandId === "go_for_the_bell") score -= 2;
  if (setup.riskLevel === "composed" && ["showboat", "go_for_the_bell"].includes(commandId)) score -= 2;
  if (setup.riskLevel === "all_in" && ["back_off", "cover_up"].includes(commandId)) score -= 1;

  return score;
}

function getPhaseWeight(phase: DebatePhase) {
  if (phase === "opening") return 1;
  if (phase === "rebuttal") return 1.2;
  return 1.4;
}

function getImpactProfile(commandId: LiveCommandId, value: number) {
  const swingTag =
    value >= 7
      ? "Crowd erupted"
      : value >= 4
        ? "Took space"
        : value >= 1
          ? "Held center"
          : value <= -5
            ? "Blew the exchange"
            : value <= -2
              ? "Got clipped"
              : "Kept moving";

  const profiles: Record<
    LiveCommandId,
    { state: FighterState; action: FighterAction; impact: ImpactType; commentary: string }
  > = {
    rush_in: {
      state: value >= 0 ? "advancing" : "overextended",
      action: value >= 0 ? "lunge" : "stumble",
      impact: value >= 0 ? "hit" : "crash",
      commentary: value >= 0 ? "crashed into the pocket and shoved the ring back" : "ran in too hot and got caught reaching",
    },
    back_off: {
      state: value >= 0 ? "recovering" : "guarded",
      action: value >= 0 ? "idle" : "recoil",
      impact: "recovery",
      commentary: value >= 0 ? "pulled out of danger and reset the feet" : "gave up too much ground trying to breathe",
    },
    slip_counter: {
      state: value >= 0 ? "crowd_favorite" : "rocked",
      action: value >= 0 ? "jab" : "recoil",
      impact: value >= 0 ? "hit" : "whiff",
      commentary: value >= 0 ? "made the whiff look stupid and snapped back clean" : "went fishing for the counter and missed the cue",
    },
    cover_up: {
      state: value >= 0 ? "guarded" : "rocked",
      action: value >= 0 ? "block" : "ringout_pressure",
      impact: "block",
      commentary: value >= 0 ? "shelled up and let the heat roll past" : "hid too long and let the room turn on it",
    },
    showboat: {
      state: value >= 0 ? "crowd_favorite" : "overextended",
      action: "taunt",
      impact: value >= 0 ? "hype" : "crash",
      commentary: value >= 0 ? "played to the crowd and actually stole the room" : "got greedy for attention and opened the chin",
    },
    plant_your_feet: {
      state: value >= 0 ? "guarded" : "recovering",
      action: value >= 0 ? "block" : "exhausted",
      impact: value >= 0 ? "recovery" : "whiff",
      commentary: value >= 0 ? "stopped the skid and stood its ground" : "froze up trying to look stable",
    },
    stick_the_jab: {
      state: value >= 0 ? "advancing" : "guarded",
      action: "jab",
      impact: value >= 0 ? "hit" : "block",
      commentary: value >= 0 ? "kept peppering the same ugly spot until it mattered" : "kept poking without making the room care",
    },
    go_for_the_bell: {
      state: value >= 0 ? "crowd_favorite" : "rocked",
      action: value >= 0 ? "lunge" : "stumble",
      impact: value >= 0 ? "hit" : "crash",
      commentary: value >= 0 ? "threw the wild finisher and the room lost its mind" : "sold out for the finish and nearly ate canvas",
    },
  };

  return { ...profiles[commandId], swingTag };
}

function maybeLockSetup(match: MatchRecord) {
  if (match.state !== "setup_open") return;
  const allSubmitted = match.players.every((player) => player.setupSubmittedAt);
  const expired = typeof match.setupDeadlineAt === "number" && Date.now() >= match.setupDeadlineAt;
  if (!allSubmitted && !expired) return;
  match.setupDeadlineAt = null;
  match.updatedAt = Date.now();
  addEvent(match, "setup_locked", "Gloves up. Opening bell incoming.");
  startLivePhase(match, "opening");
}

function markDisconnectedPlayers(match: MatchRecord) {
  if (!["waiting_for_players", "setup_open", "live_phase_open"].includes(match.state)) return;

  for (const player of match.players) {
    const roomPlayer = getStore().roomPlayers.get(roomPlayerKey(match.roomId, player.playerId));
    if (!roomPlayer) continue;
    const stale = Date.now() - roomPlayer.lastSeenAt > 60_000;
    if (stale && !player.disconnectedSince) {
      player.disconnectedSince = Date.now();
      addEvent(
        match,
        "player_disconnected",
        `${currentPlayerName(player.playerId)} dropped from the room. Holding for 60 seconds.`,
      );
    }
    if (!stale) {
      player.disconnectedSince = null;
    }
  }

  const fullyGone = match.players.some(
    (player) => player.disconnectedSince && Date.now() - player.disconnectedSince > 60_000,
  );
  if (fullyGone) {
    match.state = "abandoned";
    match.updatedAt = Date.now();
    addEvent(match, "match_abandoned", "Room abandoned because a coach disconnected for too long.");
  }
}

async function callOpenAIJson<T>(system: string, user: string): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) return null;
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function createTurnText(args: {
  playerName: string;
  agentId: AgentAssignmentRecord["id"];
  phase: DebatePhase;
  setupPlan: SetupPlan | null;
  phaseBeats: ArenaBeat[];
  topicTitle: string;
}) {
  const { playerName, agentId, phase, setupPlan, phaseBeats, topicTitle } = args;
  const agent = getAgentDefinition(agentId);
  const beatFlavor = phaseBeats.slice(-2).map((beat) => `${beat.commandLabel.toLowerCase()} ${beat.commentary}`).join(" Then ");
  const setupFlavor = setupPlan?.signatureLine ? `The corner kept yelling "${setupPlan.signatureLine}".` : "";
  return `${playerName}'s ${agent.name} worked the ${phase} like a messy room fight about ${topicTitle.toLowerCase()}. ${beatFlavor}. ${setupFlavor}`.slice(
    0,
    agent.responseBudget * 5,
  );
}

async function resolveTurn(match: MatchRecord, player: MatchPlayerRecord, phase: DebatePhase) {
  const agent = player.agent!;
  const playerName = currentPlayerName(player.playerId);
  const phaseBeats = match.arenaTimeline.filter((beat) => beat.playerId === player.playerId && beat.phase === phase);
  const setupScore = setupFitsAgent(agent.id, player.setupPlan);
  const commandValue = phaseBeats.reduce((sum, beat) => {
    const point = match.momentumTimeline.find((entry) => entry.id === `${beat.id}_momentum`);
    return sum + (point?.value ?? 0);
  }, 0);
  const microScore = clamp(
    Math.round(agent.expectedScore + setupScore * 0.35 + commandValue * 1.4 + getPhaseWeight(phase) * 2 + player.hypeLevel - player.staggerLevel),
    40,
    98,
  );
  const swingTag = phaseBeats.slice(-1)[0]?.swingTag ?? "Held center";

  const openAiTurn = await callOpenAIJson<{ speech: string; microScore?: number }>(
    "You are generating one short fight-call recap for a chaotic stickman boxing room. Return JSON with speech and microScore only.",
    JSON.stringify({
      topic: match.topic.title,
      phase,
      agent,
      setupPlan: player.setupPlan,
      phaseBeats,
    }),
  );

  const content =
    openAiTurn?.speech?.trim() ||
    createTurnText({
      playerName,
      agentId: agent.id,
      phase,
      setupPlan: player.setupPlan,
      phaseBeats,
      topicTitle: match.topic.title,
    });

  match.turns.push({
    id: randomId("turn"),
    phase,
    playerId: player.playerId,
    playerName,
    agentId: agent.id,
    content,
    microScore: clamp(openAiTurn?.microScore ?? microScore, 40, 98),
    swingTag,
    momentumDelta: commandValue,
    createdAt: Date.now(),
  });

  addEvent(match, "turn_resolved", `${playerName}'s ${agent.id} ended the ${phase} looking ${swingTag.toLowerCase()}.`);
}

function categoryScores(score: number, turns: MatchTurn[]) {
  const spread = (value: number, offset: number) => clamp(Math.round(value + offset), 40, 99);
  const opening = turns[0]?.microScore ?? score;
  const rebuttal = turns[1]?.microScore ?? score;
  const closing = turns[2]?.microScore ?? score;
  return {
    clarity: spread(opening, -2),
    relevance: spread(rebuttal, -1),
    rebuttal: spread(rebuttal, 0),
    evidence: spread(opening, -4),
    consistency: spread(closing, -1),
  };
}

function determineDecisiveMoment(match: MatchRecord) {
  if (match.momentumTimeline.length === 0) return null;
  const decisive = [...match.momentumTimeline].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]!;
  const chain = match.commands
    .filter((command) => command.playerId === decisive.playerId && command.phase === decisive.phase && command.createdAt <= decisive.createdAt)
    .slice(-2);
  return {
    playerId: decisive.playerId,
    playerName: decisive.playerName,
    phase: decisive.phase,
    commands: chain.map((command) => command.commandId),
    summary: `${chain.map((command) => command.label).join(" + ")} broke the stance.`,
    swingValue: decisive.value,
  } satisfies JudgeResult["decisiveMoment"];
}

function updateRivalry(match: MatchRecord) {
  if (match.seriesRecorded || !match.judgeResult) return;
  const room = getStore().rooms.get(match.roomId);
  if (!room) return;
  room.rivalry.roundsPlayed += 1;
  room.rivalry.winsByPlayer[match.judgeResult.winnerPlayerId] =
    (room.rivalry.winsByPlayer[match.judgeResult.winnerPlayerId] ?? 0) + 1;
  if (room.rivalry.currentStreakPlayerId === match.judgeResult.winnerPlayerId) {
    room.rivalry.currentStreakCount += 1;
  } else {
    room.rivalry.currentStreakPlayerId = match.judgeResult.winnerPlayerId;
    room.rivalry.currentStreakCount = 1;
  }
  match.seriesRecorded = true;
}

async function judgeMatch(match: MatchRecord) {
  const scoresByPlayer: Record<string, number> = {};
  const scoresByCategory: JudgeResult["scoresByCategory"] = {};

  for (const player of match.players) {
    const turns = match.turns.filter((turn) => turn.playerId === player.playerId);
    const actual = clamp(
      Math.round(turns.reduce((sum, turn) => sum + turn.microScore, 0) / Math.max(turns.length, 1)),
      40,
      98,
    );
    player.agent!.actualScore = actual;
    player.agent!.rigScore = actual - player.agent!.expectedScore;
    player.agent!.rigLabel = scoreLabel(player.agent!.rigScore);
    scoresByPlayer[player.playerId] = actual;
    scoresByCategory[player.playerId] = categoryScores(actual, turns);
  }

  const winner = [...match.players].sort((a, b) => scoresByPlayer[b.playerId]! - scoresByPlayer[a.playerId]!)[0]!;
  const upset = [...match.players].sort((a, b) => (b.agent?.rigScore ?? -99) - (a.agent?.rigScore ?? -99))[0]!;
  const decisiveMoment = determineDecisiveMoment(match);
  const confidence = Number(
    (0.7 + Math.min(0.24, Math.abs(scoresByPlayer[winner.playerId]! - scoresByPlayer[getOpponent(match, winner.playerId).playerId]!) / 100)).toFixed(2),
  );

  const openAiJudge = await callOpenAIJson<{ reasonSummary: string; coachingImpactSummary: string }>(
    "You are writing a short ringside summary for a chaotic stickman boxing game. Return JSON with reasonSummary and coachingImpactSummary.",
    JSON.stringify({
      topic: match.topic.title,
      arenaTimeline: match.arenaTimeline.slice(-10),
      decisiveMoment,
      winner: currentPlayerName(winner.playerId),
      upset: currentPlayerName(upset.playerId),
    }),
  );

  match.judgeResult = {
    winnerPlayerId: winner.playerId,
    scoresByPlayer,
    scoresByCategory,
    reasonSummary:
      openAiJudge?.reasonSummary?.trim() ||
      `${currentPlayerName(winner.playerId)} took the room by controlling the center and surviving the mess better.`,
    confidence,
    decisiveMoment,
    coachingImpactSummary:
      openAiJudge?.coachingImpactSummary?.trim() ||
      `${currentPlayerName(upset.playerId)} created the bigger collapse-or-comeback swing in the room.`,
  };

  if (decisiveMoment) {
    addEvent(match, "decisive_moment_found", decisiveMoment.summary);
  }
  addEvent(match, "judging_complete", `Judge confidence settled at ${(confidence * 100).toFixed(0)}%.`);
  match.state = "reveal_ready";
  match.revealAt = Date.now();
  match.currentPhase = null;
  match.phaseDeadlineAt = null;
  match.updatedAt = Date.now();
  addEvent(match, "reveal_ready", "Reveal unlocked. Someone just owned the room.");
  updateRivalry(match);
}

async function resolveCurrentPhase(match: MatchRecord) {
  if (match.state !== "live_phase_open" || !match.currentPhase) return;
  const phase = match.currentPhase;
  addEvent(match, "live_phase_locked", `${phase[0]!.toUpperCase()}${phase.slice(1)} bell closed.`);
  match.phaseDeadlineAt = null;
  for (const player of match.players) {
    await resolveTurn(match, player, phase);
  }
  const nextPhase = PHASES[PHASES.indexOf(phase) + 1] ?? null;
  if (nextPhase) {
    startLivePhase(match, nextPhase);
  } else {
    match.state = "judging";
    match.updatedAt = Date.now();
    await judgeMatch(match);
  }
}

export async function ensureProgress(matchId: string) {
  const match = getStore().matches.get(matchId);
  if (!match) return null;

  refreshAllEnergy(match);
  markDisconnectedPlayers(match);
  if (match.state === "abandoned") return match;
  maybeLockSetup(match);

  while (match.state === "live_phase_open" && match.phaseDeadlineAt && Date.now() >= match.phaseDeadlineAt) {
    await resolveCurrentPhase(match);
  }

  if (match.state === "reveal_ready" && match.revealAt && Date.now() - match.revealAt > getRevealDurationMs()) {
    match.state = "completed";
  }

  return match;
}

export function createPlayer(name: string) {
  const player: PlayerRecord = {
    id: randomId("player"),
    name: name.trim(),
    createdAt: Date.now(),
  };
  getStore().players.set(player.id, player);
  return player;
}

export function getPlayer(playerId: string | null | undefined) {
  if (!playerId) return null;
  return getStore().players.get(playerId) ?? null;
}

export function resetStore() {
  globalThis.__rigdStore__ = createStore();
}

export async function createRoom(hostPlayerId: string, origin: string) {
  const store = getStore();
  const room: RoomRecord = {
    id: randomId("room"),
    code: roomCode(),
    createdAt: Date.now(),
    hostPlayerId,
    playerIds: [hostPlayerId],
    activeMatchId: randomId("match"),
    rivalry: {
      roundsPlayed: 0,
      currentStreakPlayerId: null,
      currentStreakCount: 0,
      winsByPlayer: {},
    },
  };
  store.rooms.set(room.id, room);
  store.roomPlayers.set(roomPlayerKey(room.id, hostPlayerId), {
    roomId: room.id,
    playerId: hostPlayerId,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  const baseState = makeDefaultFighterState();
  store.matches.set(room.activeMatchId, {
    id: room.activeMatchId,
    roomId: room.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: "waiting_for_players",
    topic: shuffle(DEBATE_TOPICS)[0]!,
    setupDeadlineAt: null,
    phaseDeadlineAt: null,
    currentPhase: null,
    revealAt: null,
    currentBeat: 0,
    players: [
      {
        playerId: hostPlayerId,
        readyAt: null,
        setupPlan: null,
        setupSubmittedAt: null,
        disconnectedSince: null,
        agent: null,
        cornerEnergy: ENERGY_CAP,
        lastEnergyTickAt: Date.now(),
        lastCommandAt: null,
        ...baseState,
      },
    ],
    turns: [],
    commands: [],
    momentumTimeline: [],
    arenaTimeline: [],
    judgeResult: null,
    events: [],
    seriesRecorded: false,
  });
  addEvent(store.matches.get(room.activeMatchId)!, "player_joined", `${currentPlayerName(hostPlayerId)} created room ${room.code}.`);
  return buildSnapshot(room.id, hostPlayerId, origin);
}

export async function joinRoomByCode(code: string, playerId: string, origin: string) {
  const store = getStore();
  const room = [...store.rooms.values()].find((entry) => entry.code === code.toUpperCase());
  if (!room) throw new Error("Room not found.");
  if (!room.playerIds.includes(playerId)) {
    if (room.playerIds.length >= 2) throw new Error("Room is already full.");
    room.playerIds.push(playerId);
    store.roomPlayers.set(roomPlayerKey(room.id, playerId), {
      roomId: room.id,
      playerId,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    const baseState = makeDefaultFighterState();
    store.matches.get(room.activeMatchId)!.players.push({
      playerId,
      readyAt: null,
      setupPlan: null,
      setupSubmittedAt: null,
      disconnectedSince: null,
      agent: null,
      cornerEnergy: ENERGY_CAP,
      lastEnergyTickAt: Date.now(),
      lastCommandAt: null,
      ...baseState,
    });
    addEvent(store.matches.get(room.activeMatchId)!, "player_joined", `${currentPlayerName(playerId)} joined the room.`);
  }
  return buildSnapshot(room.id, playerId, origin);
}

export async function setReady(matchId: string, playerId: string, origin: string) {
  const match = await ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  const room = getStore().rooms.get(match.roomId)!;
  const player = match.players.find((entry) => entry.playerId === playerId);
  if (!player) throw new Error("Player not in match.");
  heartbeat(room.id, playerId);
  player.readyAt = Date.now();
  match.updatedAt = Date.now();
  addEvent(match, "player_ready", `${currentPlayerName(playerId)} is ready.`);
  if (match.state === "waiting_for_players" && match.players.length === 2 && match.players.every((entry) => entry.readyAt)) {
    startSetup(match);
  }
  return buildSnapshot(room.id, playerId, origin);
}

export async function submitSetup(matchId: string, playerId: string, setupPlan: SetupPlan, origin: string) {
  const match = await ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  if (match.state !== "setup_open") throw new Error("Setup is closed.");
  const player = match.players.find((entry) => entry.playerId === playerId);
  if (!player) throw new Error("Player not in match.");
  if (player.setupSubmittedAt) throw new Error("Setup already submitted.");
  heartbeat(match.roomId, playerId);
  player.setupPlan = setupPlan;
  player.setupSubmittedAt = Date.now();
  match.updatedAt = Date.now();
  addEvent(match, "setup_submitted", `${currentPlayerName(playerId)} locked a corner stance.`);
  maybeLockSetup(match);
  return buildSnapshot(match.roomId, playerId, origin);
}

export async function submitCoaching(matchId: string, playerId: string, setupPlan: SetupPlan, origin: string) {
  return submitSetup(matchId, playerId, setupPlan, origin);
}

export async function submitLiveCommand(matchId: string, playerId: string, commandId: LiveCommandId, origin: string) {
  const match = await ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  if (match.state !== "live_phase_open" || !match.currentPhase) {
    throw new Error("Live corner is closed.");
  }

  const player = match.players.find((entry) => entry.playerId === playerId);
  if (!player || !player.agent) throw new Error("Player not in match.");
  const opponent = getOpponent(match, playerId);
  heartbeat(match.roomId, playerId);
  refreshPlayerEnergy(player);

  const command = getLiveCommandDefinition(commandId);
  if (player.cornerEnergy < command.cost) {
    throw new Error("Not enough corner energy.");
  }

  const repeatPenalty = getRepeatedCommandCount(match, playerId, match.currentPhase, commandId) * 2;
  const comebackBonus = player.momentum < opponent.momentum ? 2 : 0;
  const value =
    1 +
    getCommandAgentFit(player.agent.id, commandId) +
    getCommandSetupFit(player.setupPlan, commandId, match.currentPhase) +
    comebackBonus -
    repeatPenalty;
  const profile = getImpactProfile(commandId, value);

  player.cornerEnergy -= command.cost;
  player.lastEnergyTickAt = Date.now();
  player.lastCommandAt = Date.now();
  player.momentum = clamp(player.momentum + value, -20, 20);
  opponent.momentum = clamp(opponent.momentum - Math.max(1, Math.round(value * 0.6)), -20, 20);

  player.fighterState = profile.state;
  player.fighterAction = profile.action;
  player.lastImpactType = profile.impact;
  player.ringPosition = clamp(player.ringPosition + value, -12, 12);
  player.staggerLevel = clamp(player.staggerLevel + (value < 0 ? 2 : -1), 0, 10);
  player.hypeLevel = clamp(player.hypeLevel + (profile.impact === "hype" ? 3 : value > 0 ? 1 : -1), 0, 10);

  opponent.fighterState =
    value >= 5 ? "rocked" : value >= 2 ? "recovering" : value <= -2 ? "crowd_favorite" : "guarded";
  opponent.fighterAction =
    value >= 5 ? "stumble" : value >= 2 ? "recoil" : value <= -2 ? "taunt" : "block";
  opponent.lastImpactType = value >= 1 ? "hit" : profile.impact === "crash" ? "recovery" : "block";
  opponent.ringPosition = clamp(opponent.ringPosition - value, -12, 12);
  opponent.staggerLevel = clamp(opponent.staggerLevel + Math.max(0, Math.round(value / 2)), 0, 10);
  opponent.hypeLevel = clamp(opponent.hypeLevel + (value < 0 ? 2 : -1), 0, 10);

  const commandEntry: MatchCommand = {
    id: randomId("command"),
    phase: match.currentPhase,
    playerId,
    playerName: currentPlayerName(playerId),
    agentId: player.agent.id,
    commandId,
    label: command.label,
    cost: command.cost,
    energyAfter: player.cornerEnergy,
    createdAt: Date.now(),
  };
  match.commands.push(commandEntry);

  const momentumPoint: MomentumPoint = {
    id: `${commandEntry.id}_momentum`,
    phase: match.currentPhase,
    playerId,
    playerName: commandEntry.playerName,
    commandId,
    commandLabel: command.label,
    value,
    swingTag: profile.swingTag,
    createdAt: commandEntry.createdAt,
  };
  match.momentumTimeline.push(momentumPoint);

  match.currentBeat += 1;
  const beat: ArenaBeat = {
    id: randomId("beat"),
    phase: match.currentPhase,
    beatNumber: match.currentBeat,
    playerId,
    playerName: commandEntry.playerName,
    agentId: player.agent.id,
    commandId,
    commandLabel: command.label,
    fighterState: player.fighterState,
    fighterAction: player.fighterAction,
    ringPosition: player.ringPosition,
    staggerLevel: player.staggerLevel,
    hypeLevel: player.hypeLevel,
    impactType: profile.impact,
    swingTag: profile.swingTag,
    commentary: profile.commentary,
    createdAt: commandEntry.createdAt,
  };
  match.arenaTimeline.push(beat);
  match.updatedAt = Date.now();

  addEvent(match, "command_used", `${commandEntry.playerName} yelled ${command.label}.`);
  addEvent(match, "arena_beat_resolved", `${commandEntry.playerName}'s ${player.agent.id} ${profile.commentary}.`);
  addEvent(match, "momentum_updated", `${commandEntry.playerName} made the ring tilt ${profile.swingTag.toLowerCase()}.`);

  return buildSnapshot(match.roomId, playerId, origin);
}

export async function buildSnapshot(roomId: string, viewerPlayerId: string | null, origin: string): Promise<MatchSnapshot> {
  const room = getStore().rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  const match = await ensureProgress(room.activeMatchId);
  if (!match) throw new Error("Match not found.");
  if (viewerPlayerId && room.playerIds.includes(viewerPlayerId)) {
    heartbeat(room.id, viewerPlayerId);
  }

  return {
    room: {
      id: room.id,
      code: room.code,
      shareUrl: `${origin}/join/${room.code}`,
      rivalry: { ...room.rivalry, winsByPlayer: { ...room.rivalry.winsByPlayer } },
    },
    match: {
      id: match.id,
      state: match.state,
      topic: match.topic,
      setupDeadlineAt: match.setupDeadlineAt,
      phaseDeadlineAt: match.phaseDeadlineAt,
      currentPhase: match.currentPhase,
      startedAt: match.createdAt,
      revealAt: match.revealAt,
      currentBeat: match.currentBeat,
    },
    viewerPlayerId,
    players: match.players.map((player) => {
      const profile = getStore().players.get(player.playerId)!;
      const agent = player.agent ? getAgentDefinition(player.agent.id) : null;
      return {
        id: player.playerId,
        name: profile.name,
        ready: Boolean(player.readyAt),
        submittedSetup: Boolean(player.setupSubmittedAt),
        disconnected: Boolean(player.disconnectedSince),
        setupPlan: player.setupPlan,
        agent: agent
          ? {
              id: agent.id,
              name: agent.name,
              visibleTraits: agent.visibleTraits,
              flavor: agent.flavor,
              bandanaColor: agent.bandanaColor,
              publicHint: agent.publicHint,
              publicDanger: agent.publicDanger,
            }
          : null,
        expectedScore: player.agent?.expectedScore ?? null,
        actualScore: player.agent?.actualScore ?? null,
        rigScore: player.agent?.rigScore ?? null,
        rigLabel: player.agent?.rigLabel ?? null,
        cornerEnergy: player.cornerEnergy,
        lastCommandAt: player.lastCommandAt,
        activeCommandFeed: match.commands.filter((command) => command.playerId === player.playerId).slice(-3).reverse(),
        momentum: player.momentum,
        fighterState: player.fighterState,
        fighterAction: player.fighterAction,
        ringPosition: player.ringPosition,
        staggerLevel: player.staggerLevel,
        hypeLevel: player.hypeLevel,
        lastImpactType: player.lastImpactType,
      };
    }),
    turnLog: [...match.turns],
    commandFeed: [...match.commands].slice(-12).reverse(),
    momentumTimeline: [...match.momentumTimeline],
    arenaTimeline: [...match.arenaTimeline].slice(-16).reverse(),
    judgeResult: match.judgeResult,
    events: [...match.events].slice(0, 12),
  };
}

export async function getMatchSnapshot(matchId: string, playerId: string | null, origin: string) {
  const match = await ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  return buildSnapshot(match.roomId, playerId, origin);
}

export async function getReplay(matchId: string, playerId: string | null, origin: string) {
  const snapshot = await getMatchSnapshot(matchId, playerId, origin);
  if (!snapshot.judgeResult) throw new Error("Replay is not ready yet.");
  return snapshot;
}

export async function startRematch(roomId: string, origin: string) {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.playerIds.length !== 2) throw new Error("Rematch requires both players.");

  room.activeMatchId = randomId("match");
  const now = Date.now();
  store.matches.set(room.activeMatchId, {
    id: room.activeMatchId,
    roomId: room.id,
    createdAt: now,
    updatedAt: now,
    state: "waiting_for_players",
    topic: shuffle(DEBATE_TOPICS)[0]!,
    setupDeadlineAt: null,
    phaseDeadlineAt: null,
    currentPhase: null,
    revealAt: null,
    currentBeat: 0,
    players: room.playerIds.map((playerId) => ({
      playerId,
      readyAt: null,
      setupPlan: null,
      setupSubmittedAt: null,
      disconnectedSince: null,
      agent: null,
      cornerEnergy: ENERGY_CAP,
      lastEnergyTickAt: now,
      lastCommandAt: null,
      ...makeDefaultFighterState(),
    })),
    turns: [],
    commands: [],
    momentumTimeline: [],
    arenaTimeline: [],
    judgeResult: null,
    events: [],
    seriesRecorded: false,
  });
  addEvent(store.matches.get(room.activeMatchId)!, "player_joined", "Same room, fresh gloves, same grudge.");
  return buildSnapshot(room.id, room.playerIds[0]!, origin);
}
