import {
  AGENT_DEFINITIONS,
  DEBATE_TOPICS,
  LIVE_COMMAND_DEFINITIONS,
  getAgentDefinition,
  getLiveCommandDefinition,
} from "@/lib/content";
import {
  DebatePhase,
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
};

type RivalryRecord = {
  roundsPlayed: number;
  currentStreakPlayerId: string | null;
  currentStreakCount: number;
  winsByPlayer: Record<string, number>;
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
  players: MatchPlayerRecord[];
  turns: MatchTurn[];
  commands: MatchCommand[];
  momentumTimeline: MomentumPoint[];
  momentumByPlayer: Record<string, number>;
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
    match.momentumByPlayer[player.playerId] = 0;
  });
}

function refreshPlayerEnergy(player: MatchPlayerRecord, now = Date.now()) {
  if (!player.lastEnergyTickAt) {
    player.lastEnergyTickAt = now;
    return;
  }
  const elapsedTicks = Math.floor((now - player.lastEnergyTickAt) / ENERGY_REGEN_MS);
  if (elapsedTicks <= 0) return;
  player.cornerEnergy = Math.min(ENERGY_CAP, player.cornerEnergy + elapsedTicks);
  player.lastEnergyTickAt += elapsedTicks * ENERGY_REGEN_MS;
}

function refreshAllEnergy(match: MatchRecord, now = Date.now()) {
  match.players.forEach((player) => refreshPlayerEnergy(player, now));
}

function getOpponent(match: MatchRecord, playerId: string) {
  return match.players.find((player) => player.playerId !== playerId)!;
}

function startSetup(match: MatchRecord) {
  if (match.players.length !== 2 || !match.players.every((player) => player.readyAt)) return;
  if (!match.players.every((player) => player.agent)) {
    assignAgents(match);
  }
  match.state = "setup_open";
  match.setupDeadlineAt = Date.now() + getSetupDurationMs();
  match.updatedAt = Date.now();
  addEvent(match, "setup_started", "Corners are open. You have 18 seconds to set the plan.");
}

function startLivePhase(match: MatchRecord, phase: DebatePhase) {
  match.state = "live_phase_open";
  match.currentPhase = phase;
  match.phaseDeadlineAt = Date.now() + getPhaseDurationMs();
  match.updatedAt = Date.now();
  addEvent(match, "live_phase_started", `${phase[0]!.toUpperCase()}${phase.slice(1)} bell. Corners are live.`);
}

function setupFitsAgent(agentId: AgentAssignmentRecord["id"], setup: SetupPlan | null) {
  if (!setup) {
    return {
      score: -6,
      explanation: `${getAgentDefinition(agentId).name} went in with almost no corner structure.`,
    };
  }

  const openingFit: Record<AgentAssignmentRecord["id"], Record<SetupPlan["openingStyle"], number>> = {
    Bruiser: { fast_start: 4, measured: 1, needle: 1, showboat: -2 },
    Gremlin: { fast_start: 1, measured: 0, needle: 4, showboat: 2 },
    Scholar: { fast_start: -1, measured: 4, needle: 2, showboat: -3 },
    Showman: { fast_start: 2, measured: 0, needle: 1, showboat: 4 },
  };
  const pressureFit: Record<AgentAssignmentRecord["id"], Record<SetupPlan["pressureRule"], number>> = {
    Bruiser: { counter_first: 1, reset_frame: -1, trade_shots: 4, stay_grounded: 1 },
    Gremlin: { counter_first: 2, reset_frame: 1, trade_shots: -1, stay_grounded: 2 },
    Scholar: { counter_first: 3, reset_frame: 4, trade_shots: -3, stay_grounded: 2 },
    Showman: { counter_first: 1, reset_frame: 1, trade_shots: 2, stay_grounded: 2 },
  };
  const riskFit: Record<AgentAssignmentRecord["id"], Record<SetupPlan["riskLevel"], number>> = {
    Bruiser: { composed: 1, pressing: 3, all_in: -1 },
    Gremlin: { composed: 0, pressing: 2, all_in: 1 },
    Scholar: { composed: 4, pressing: 1, all_in: -4 },
    Showman: { composed: 0, pressing: 2, all_in: 3 },
  };

  let score =
    openingFit[agentId][setup.openingStyle] +
    pressureFit[agentId][setup.pressureRule] +
    riskFit[agentId][setup.riskLevel];

  if (setup.signatureLine) {
    score += setup.signatureLine.length >= 8 && setup.signatureLine.length <= 48 ? 1 : 0;
  }

  score = Math.round(score * getAgentDefinition(agentId).promptSensitivity);

  const explanation =
    score >= 9
      ? `${getAgentDefinition(agentId).name} got a setup that matches its lane.`
      : score <= 0
        ? `${getAgentDefinition(agentId).name} got pointed toward its own bad habits.`
        : `${getAgentDefinition(agentId).name} got a usable starting frame without a real edge.`;

  return { score, explanation };
}

function getTopicFit(agentId: AgentAssignmentRecord["id"], topic: MatchRecord["topic"], setup: SetupPlan | null) {
  let score = 0;
  if (agentId === "Bruiser" && topic.tags.some((tag) => ["simple", "high-emotion", "punchy"].includes(tag))) {
    score += 3;
  }
  if (agentId === "Gremlin" && topic.tags.some((tag) => ["hot-take", "punchy", "behavior"].includes(tag))) {
    score += 3;
  }
  if (agentId === "Scholar" && topic.tags.some((tag) => ["policy", "moderate", "tradeoffs", "work"].includes(tag))) {
    score += 3;
  }
  if (agentId === "Showman" && topic.tags.some((tag) => ["culture", "hot-take", "high-emotion"].includes(tag))) {
    score += 3;
  }

  if (setup?.riskLevel === "all_in" && topic.tags.includes("moderate")) score -= 2;
  if (setup?.riskLevel === "composed" && topic.tags.includes("high-emotion")) score -= 1;
  if (setup?.openingStyle === "showboat" && topic.tags.includes("policy")) score -= 1;
  if (setup?.openingStyle === "measured" && topic.tags.includes("policy")) score += 1;

  return score;
}

function getRepeatedCommandCount(match: MatchRecord, playerId: string, phase: DebatePhase, commandId: LiveCommandId) {
  return match.commands.filter(
    (command) =>
      command.playerId === playerId && command.phase === phase && command.commandId === commandId,
  ).length;
}

function getCommandAgentFit(agentId: AgentAssignmentRecord["id"], commandId: LiveCommandId) {
  const fit: Record<AgentAssignmentRecord["id"], Record<LiveCommandId, number>> = {
    Bruiser: {
      push: 2,
      reset: 0,
      counter: 1,
      stay_tight: 3,
      crowd_pleaser: 0,
      ground_it: 0,
      one_example: 1,
      big_finish: 1,
    },
    Gremlin: {
      push: 1,
      reset: 0,
      counter: 2,
      stay_tight: -1,
      crowd_pleaser: 1,
      ground_it: 0,
      one_example: 3,
      big_finish: 1,
    },
    Scholar: {
      push: -1,
      reset: 2,
      counter: 2,
      stay_tight: 1,
      crowd_pleaser: -2,
      ground_it: 3,
      one_example: 1,
      big_finish: -1,
    },
    Showman: {
      push: 1,
      reset: 0,
      counter: 0,
      stay_tight: -1,
      crowd_pleaser: 3,
      ground_it: 1,
      one_example: 0,
      big_finish: 3,
    },
  };

  return fit[agentId][commandId];
}

function getCommandSetupFit(setup: SetupPlan | null, commandId: LiveCommandId, phase: DebatePhase) {
  if (!setup) return -1;

  let score = 0;
  const openingMatches: Record<SetupPlan["openingStyle"], LiveCommandId[]> = {
    fast_start: ["push", "crowd_pleaser"],
    measured: ["reset", "ground_it"],
    needle: ["counter", "one_example"],
    showboat: ["crowd_pleaser", "big_finish"],
  };
  const pressureMatches: Record<SetupPlan["pressureRule"], LiveCommandId[]> = {
    counter_first: ["counter"],
    reset_frame: ["reset", "ground_it"],
    trade_shots: ["push", "crowd_pleaser"],
    stay_grounded: ["ground_it", "stay_tight", "one_example"],
  };
  const riskMatches: Record<SetupPlan["riskLevel"], LiveCommandId[]> = {
    composed: ["reset", "ground_it", "stay_tight"],
    pressing: ["push", "counter", "one_example"],
    all_in: ["crowd_pleaser", "big_finish", "push"],
  };

  if (openingMatches[setup.openingStyle].includes(commandId)) score += phase === "opening" ? 2 : 1;
  if (pressureMatches[setup.pressureRule].includes(commandId)) score += 2;
  if (riskMatches[setup.riskLevel].includes(commandId)) score += 1;

  if (setup.riskLevel === "composed" && ["crowd_pleaser", "big_finish"].includes(commandId)) score -= 2;
  if (setup.riskLevel === "all_in" && ["reset", "ground_it"].includes(commandId)) score -= 1;
  if (phase !== "closing" && commandId === "big_finish") score -= 2;

  return score;
}

function swingTagForImpact(value: number) {
  if (value >= 6) return "Stole the crowd";
  if (value >= 3) return "Recovered";
  if (value >= 1) return "Held shape";
  if (value <= -4) return "Lost structure";
  if (value <= -2) return "Overextended";
  return "Jabbed";
}

function getMomentumGap(match: MatchRecord, playerId: string) {
  const playerMomentum = match.momentumByPlayer[playerId] ?? 0;
  const opponentMomentum = match.momentumByPlayer[getOpponent(match, playerId).playerId] ?? 0;
  return playerMomentum - opponentMomentum;
}

function evaluateLiveCommand(match: MatchRecord, player: MatchPlayerRecord, commandId: LiveCommandId, phase: DebatePhase) {
  const setup = player.setupPlan;
  const repeatCount = getRepeatedCommandCount(match, player.playerId, phase, commandId);
  const comebackBonus = getMomentumGap(match, player.playerId) < 0 ? 2 : 0;
  const agentFit = getCommandAgentFit(player.agent!.id, commandId);
  const setupFit = getCommandSetupFit(setup, commandId, phase);
  const repeatPenalty = repeatCount * 2;
  const value = 1 + agentFit + setupFit + comebackBonus - repeatPenalty;
  return {
    value,
    swingTag: swingTagForImpact(value),
  };
}

function maybeLockSetup(match: MatchRecord) {
  if (match.state !== "setup_open") return false;
  const allSubmitted = match.players.every((player) => player.setupSubmittedAt);
  const expired = typeof match.setupDeadlineAt === "number" && Date.now() >= match.setupDeadlineAt;
  if (!allSubmitted && !expired) return false;
  match.setupDeadlineAt = null;
  match.updatedAt = Date.now();
  addEvent(match, "setup_locked", "Corners are set. Opening bell incoming.");
  startLivePhase(match, "opening");
  return true;
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
  agentId: AgentAssignmentRecord["id"];
  playerName: string;
  setupPlan: SetupPlan | null;
  phase: DebatePhase;
  topicTitle: string;
  priorOpponentTurn: string | null;
  phaseCommands: MatchCommand[];
  swingTag: string;
  microScore: number;
}) {
  const { agentId, playerName, setupPlan, phase, topicTitle, priorOpponentTurn, phaseCommands, swingTag, microScore } =
    args;
  const agent = getAgentDefinition(agentId);
  const openingLine: Record<AgentAssignmentRecord["id"], string[]> = {
    Bruiser: [
      `Listen up. ${topicTitle} is not complicated.`,
      `Here is the blunt version: ${topicTitle} comes down to consequences.`,
    ],
    Gremlin: [
      `Everyone keeps overthinking this, so let me cut through the fog.`,
      `This fight turns on one vivid point, and you can feel it immediately.`,
    ],
    Scholar: [
      `The cleanest way to read ${topicTitle} is to separate rhetoric from outcomes.`,
      `Before anyone gets dramatic, the real issue in ${topicTitle} is incentive design.`,
    ],
    Showman: [
      `If you want the crowd version and the true version, they line up for once.`,
      `The room can smell when an argument looks polished but collapses on contact.`,
    ],
  };
  const rebuttalLine: Record<AgentAssignmentRecord["id"], string[]> = {
    Bruiser: [
      `That last answer looked busy and proved very little.`,
      `They tried to dance past the hit and still walked into it.`,
    ],
    Gremlin: [
      `Cute dodge. Still misses the thing real people notice first.`,
      `They gave you smoke. Here is the part with teeth.`,
    ],
    Scholar: [
      `The problem there is not tone. It is structure.`,
      `They answered the vibe of the claim, not the claim itself.`,
    ],
    Showman: [
      `That was a nice performance. I am still watching the scoreboard.`,
      `They chased the camera angle and forgot the argument.`,
    ],
  };
  const closingLine: Record<AgentAssignmentRecord["id"], string[]> = {
    Bruiser: [
      `Final point: strip away the noise and the better side is obvious.`,
      `End of story. The stronger case survives contact with real life.`,
    ],
    Gremlin: [
      `This is where underdogs steal it: the simpler line is also the truer one.`,
      `If the room is honest, it already knows which case actually held together.`,
    ],
    Scholar: [
      `To close, the winning case is the one with fewer leaps and cleaner incentives.`,
      `A proper closing does not add drama. It removes doubt.`,
    ],
    Showman: [
      `When the dust settles, one side still sounds brave and one side sounds right.`,
      `This closing only asks one thing: which case survives outside the room?`,
    ],
  };

  const pickedLead =
    (phase === "opening"
      ? openingLine
      : phase === "rebuttal"
        ? rebuttalLine
        : closingLine)[agentId][microScore % 2]!;

  const commands = phaseCommands.map((command) => command.label).slice(-2).join(", ");
  const commandLine = commands ? ` The corner kept barking ${commands.toLowerCase()}, and the shift was visible.` : "";
  const setupLine = setupPlan?.signatureLine ? ` It never lost the room-facing line: "${setupPlan.signatureLine}".` : "";
  const swingLine =
    swingTag === "Stole the crowd"
      ? " The whole exchange suddenly tilted."
      : swingTag === "Recovered"
        ? " The fighter looked steadier after the adjustment."
        : swingTag === "Lost structure"
          ? " The pressure got loud and the structure bent."
          : "";
  const opponentLine = priorOpponentTurn
    ? ` They leaned on "${priorOpponentTurn.slice(0, 80)}..." and that gap never closed.`
    : "";

  return `${pickedLead}${opponentLine}${commandLine}${setupLine}${swingLine}`.slice(
    0,
    agent.responseBudget * 5,
  );
}

function phaseCommandsForPlayer(match: MatchRecord, playerId: string, phase: DebatePhase) {
  return match.commands.filter((command) => command.playerId === playerId && command.phase === phase);
}

async function resolveTurn(match: MatchRecord, player: MatchPlayerRecord, phase: DebatePhase) {
  const agent = player.agent!;
  const playerName = currentPlayerName(player.playerId);
  const setupScore = setupFitsAgent(agent.id, player.setupPlan);
  const topicFit = getTopicFit(agent.id, match.topic, player.setupPlan);
  const phaseCommands = phaseCommandsForPlayer(match, player.playerId, phase);
  const commandValue = phaseCommands.reduce((sum, command) => {
    const point = match.momentumTimeline.find((entry) => entry.id === `${command.id}_momentum`);
    return sum + (point?.value ?? 0);
  }, 0);
  const momentumGap = clamp(getMomentumGap(match, player.playerId) * 0.35, -8, 8);
  const phaseModifier = phase === "opening" ? 0 : phase === "rebuttal" ? 2 : 4;
  const microScore = clamp(
    Math.round(
      agent.expectedScore +
        setupScore.score * 0.35 +
        commandValue * 1.1 +
        topicFit * 0.45 +
        momentumGap +
        phaseModifier,
    ),
    40,
    98,
  );

  const swingValue = phaseCommands.reduce((sum, command) => {
    const point = match.momentumTimeline.find((entry) => entry.id === `${command.id}_momentum`);
    return sum + (point?.value ?? 0);
  }, 0);
  const swingTag = swingTagForImpact(swingValue);
  const priorOpponentTurn =
    phase === "opening"
      ? null
      : [...match.turns].reverse().find((turn) => turn.playerId !== player.playerId)?.content ?? null;

  const openAiTurn = await callOpenAIJson<{ speech: string; microScore?: number }>(
    "You are generating one debate turn for an AI arena game with live corner coaching. Return JSON with speech and microScore only.",
    JSON.stringify({
      topic: match.topic.prompt,
      phase,
      agent,
      setupPlan: player.setupPlan,
      commands: phaseCommands,
      priorOpponentTurn,
      swingTag,
    }),
  );

  const content =
    openAiTurn?.speech?.trim() ||
    createTurnText({
      agentId: agent.id,
      playerName,
      setupPlan: player.setupPlan,
      phase,
      topicTitle: match.topic.title,
      priorOpponentTurn,
      phaseCommands,
      swingTag,
      microScore,
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
    momentumDelta: swingValue,
    createdAt: Date.now(),
  });

  addEvent(
    match,
    "turn_resolved",
    `${playerName}'s ${agent.id} finished the ${phase} with ${swingTag.toLowerCase()}.`,
  );
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
    evidence: spread(opening, -3),
    consistency: spread(closing, -1),
  };
}

function determineDecisiveMoment(match: MatchRecord) {
  if (match.momentumTimeline.length === 0) return null;
  const decisive = [...match.momentumTimeline].sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0]!;
  const sameWindow = match.commands
    .filter(
      (command) =>
        command.playerId === decisive.playerId &&
        command.phase === decisive.phase &&
        command.createdAt <= decisive.createdAt,
    )
    .slice(-2);
  const commandIds = sameWindow.map((command) => command.commandId);
  const labels = sameWindow.map((command) => command.label).join(" + ");
  return {
    playerId: decisive.playerId,
    playerName: decisive.playerName,
    phase: decisive.phase,
    commands: commandIds,
    summary: `${labels} swung the ${decisive.phase} and ${decisive.swingTag.toLowerCase()}.`,
    swingValue: decisive.value,
  } satisfies JudgeResult["decisiveMoment"];
}

function updateRivalry(match: MatchRecord) {
  if (match.seriesRecorded || !match.judgeResult) return;
  const room = getStore().rooms.get(match.roomId);
  if (!room) return;
  const rivalry = room.rivalry;
  rivalry.roundsPlayed += 1;
  rivalry.winsByPlayer[match.judgeResult.winnerPlayerId] =
    (rivalry.winsByPlayer[match.judgeResult.winnerPlayerId] ?? 0) + 1;
  if (rivalry.currentStreakPlayerId === match.judgeResult.winnerPlayerId) {
    rivalry.currentStreakCount += 1;
  } else {
    rivalry.currentStreakPlayerId = match.judgeResult.winnerPlayerId;
    rivalry.currentStreakCount = 1;
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
    const agent = player.agent!;
    agent.actualScore = actual;
    agent.rigScore = actual - agent.expectedScore;
    agent.rigLabel = scoreLabel(agent.rigScore);
    scoresByPlayer[player.playerId] = actual;
    scoresByCategory[player.playerId] = categoryScores(actual, turns);
  }

  const sorted = [...match.players].sort(
    (left, right) => scoresByPlayer[right.playerId]! - scoresByPlayer[left.playerId]!,
  );
  let winner = sorted[0]!;
  let confidence =
    0.7 + Math.min(0.24, Math.abs(scoresByPlayer[sorted[0]!.playerId]! - scoresByPlayer[sorted[1]!.playerId]!) / 100);

  const decisiveMoment = determineDecisiveMoment(match);

  const openAiJudge = await callOpenAIJson<{
    winnerPlayerId: string;
    reasonSummary: string;
    confidence: number;
    coachingImpactSummary?: string;
  }>(
    "You are the strict judge for a two-player debate game with visible corner coaching. Return JSON with winnerPlayerId, reasonSummary, confidence, and coachingImpactSummary.",
    JSON.stringify({
      topic: match.topic,
      turns: match.turns,
      commands: match.commands,
      players: match.players.map((player) => ({
        playerId: player.playerId,
        name: currentPlayerName(player.playerId),
        agent: player.agent,
        setupPlan: player.setupPlan,
      })),
    }),
  );

  if (openAiJudge?.winnerPlayerId && scoresByPlayer[openAiJudge.winnerPlayerId] !== undefined) {
    winner = match.players.find((player) => player.playerId === openAiJudge.winnerPlayerId) ?? winner;
    confidence = clamp(openAiJudge.confidence ?? confidence, 0.5, 0.99);
  }

  const upsetPlayer = [...match.players].sort(
    (left, right) => (right.agent?.rigScore ?? -99) - (left.agent?.rigScore ?? -99),
  )[0]!;

  const coachingImpactSummary =
    openAiJudge?.coachingImpactSummary?.trim() ||
    `${currentPlayerName(winner.playerId)} won the room, while ${currentPlayerName(
      upsetPlayer.playerId,
    )} created the bigger coaching swing.`;

  const reasonSummary =
    openAiJudge?.reasonSummary?.trim() ||
    `${currentPlayerName(winner.playerId)} kept the cleaner shape under pressure and converted more live corner help.`;

  const result = {
    winnerPlayerId: winner.playerId,
    scoresByPlayer,
    scoresByCategory,
    reasonSummary,
    confidence: Number(Math.max(0.66, confidence).toFixed(2)),
    decisiveMoment,
    coachingImpactSummary,
  } satisfies JudgeResult;

  match.judgeResult = result;
  if (decisiveMoment) {
    addEvent(match, "decisive_moment_found", decisiveMoment.summary);
  }
  addEvent(match, "judging_complete", `Judge confidence settled at ${(result.confidence * 100).toFixed(0)}%.`);
  match.state = "reveal_ready";
  match.revealAt = Date.now();
  match.updatedAt = Date.now();
  addEvent(match, "reveal_ready", "Reveal unlocked. The corner chaos paid off for someone.");
  updateRivalry(match);
}

async function resolveCurrentPhase(match: MatchRecord) {
  if (match.state !== "live_phase_open" || !match.currentPhase) return;
  const phase = match.currentPhase;
  addEvent(match, "live_phase_locked", `${phase[0]!.toUpperCase()}${phase.slice(1)} window closed.`);
  match.phaseDeadlineAt = null;

  for (const player of match.players) {
    await resolveTurn(match, player, phase);
  }

  const nextPhase = PHASES[PHASES.indexOf(phase) + 1] ?? null;
  if (nextPhase) {
    startLivePhase(match, nextPhase);
    return;
  }

  match.state = "judging";
  match.currentPhase = null;
  match.updatedAt = Date.now();
  await judgeMatch(match);
}

export async function ensureProgress(matchId: string) {
  const match = getStore().matches.get(matchId);
  if (!match) return null;

  refreshAllEnergy(match);
  markDisconnectedPlayers(match);
  if (match.state === "abandoned") return match;

  maybeLockSetup(match);

  while (
    match.state === "live_phase_open" &&
    typeof match.phaseDeadlineAt === "number" &&
    Date.now() >= match.phaseDeadlineAt
  ) {
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

  const now = Date.now();
  const match: MatchRecord = {
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
    players: [
      {
        playerId: hostPlayerId,
        readyAt: null,
        setupPlan: null,
        setupSubmittedAt: null,
        disconnectedSince: null,
        agent: null,
        cornerEnergy: ENERGY_CAP,
        lastEnergyTickAt: now,
        lastCommandAt: null,
      },
    ],
    turns: [],
    commands: [],
    momentumTimeline: [],
    momentumByPlayer: {},
    judgeResult: null,
    events: [],
    seriesRecorded: false,
  };

  addEvent(match, "player_joined", `${currentPlayerName(hostPlayerId)} created room ${room.code}.`);
  store.matches.set(match.id, match);
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
    const match = store.matches.get(room.activeMatchId)!;
    match.players.push({
      playerId,
      readyAt: null,
      setupPlan: null,
      setupSubmittedAt: null,
      disconnectedSince: null,
      agent: null,
      cornerEnergy: ENERGY_CAP,
      lastEnergyTickAt: Date.now(),
      lastCommandAt: null,
    });
    addEvent(match, "player_joined", `${currentPlayerName(playerId)} joined the room.`);
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

  if (match.players.length === 2 && match.players.every((entry) => entry.readyAt) && match.state === "waiting_for_players") {
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
  addEvent(match, "setup_submitted", `${currentPlayerName(playerId)} locked the corner plan.`);
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
  if (!player) throw new Error("Player not in match.");
  heartbeat(match.roomId, playerId);
  refreshPlayerEnergy(player);
  const command = getLiveCommandDefinition(commandId);

  if (player.cornerEnergy < command.cost) {
    throw new Error("Not enough corner energy.");
  }

  const impact = evaluateLiveCommand(match, player, commandId, match.currentPhase);
  player.cornerEnergy -= command.cost;
  player.lastEnergyTickAt = Date.now();
  player.lastCommandAt = Date.now();

  const commandEntry: MatchCommand = {
    id: randomId("command"),
    phase: match.currentPhase,
    playerId: player.playerId,
    playerName: currentPlayerName(player.playerId),
    agentId: player.agent!.id,
    commandId,
    label: command.label,
    cost: command.cost,
    energyAfter: player.cornerEnergy,
    createdAt: Date.now(),
  };
  match.commands.push(commandEntry);
  match.momentumByPlayer[player.playerId] = (match.momentumByPlayer[player.playerId] ?? 0) + impact.value;
  const momentumPoint: MomentumPoint = {
    id: `${commandEntry.id}_momentum`,
    phase: match.currentPhase,
    playerId: player.playerId,
    playerName: commandEntry.playerName,
    commandId,
    commandLabel: command.label,
    value: impact.value,
    swingTag: impact.swingTag,
    createdAt: commandEntry.createdAt,
  };
  match.momentumTimeline.push(momentumPoint);
  match.updatedAt = Date.now();

  addEvent(
    match,
    "command_used",
    `${commandEntry.playerName} barked ${command.label}. ${impact.swingTag}.`,
  );
  addEvent(
    match,
    "momentum_updated",
    `${commandEntry.playerName} shifted the room with ${command.label}.`,
  );

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
      rivalry: {
        roundsPlayed: room.rivalry.roundsPlayed,
        currentStreakPlayerId: room.rivalry.currentStreakPlayerId,
        currentStreakCount: room.rivalry.currentStreakCount,
        winsByPlayer: { ...room.rivalry.winsByPlayer },
      },
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
    },
    viewerPlayerId,
    players: match.players.map((player) => {
      const profile = getStore().players.get(player.playerId)!;
      const agent = player.agent ? getAgentDefinition(player.agent.id) : null;
      const activeCommandFeed = match.commands.filter((command) => command.playerId === player.playerId).slice(-3).reverse();
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
        activeCommandFeed,
        momentum: match.momentumByPlayer[player.playerId] ?? 0,
      };
    }),
    turnLog: [...match.turns],
    commandFeed: [...match.commands].slice(-12).reverse(),
    momentumTimeline: [...match.momentumTimeline],
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
  const match: MatchRecord = {
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
    })),
    turns: [],
    commands: [],
    momentumTimeline: [],
    momentumByPlayer: {},
    judgeResult: null,
    events: [],
    seriesRecorded: false,
  };
  addEvent(match, "player_joined", "Same room, fresh agents, same grudge.");
  store.matches.set(match.id, match);
  return buildSnapshot(room.id, room.playerIds[0]!, origin);
}
