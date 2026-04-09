import { AGENT_DEFINITIONS, DEBATE_TOPICS, getAgentDefinition } from "@/lib/content";
import { CoachingInput, JudgeResult, MatchEvent, MatchSnapshot, MatchState, MatchTurn } from "@/lib/types";
import { clamp, randomId, roomCode, scoreLabel, shuffle } from "@/lib/utils";

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
  coaching: CoachingInput | null;
  coachingSubmittedAt: number | null;
  disconnectedSince: number | null;
  agent: AgentAssignmentRecord | null;
};

type RoomRecord = {
  id: string;
  code: string;
  createdAt: number;
  hostPlayerId: string;
  playerIds: string[];
  activeMatchId: string;
};

type MatchRecord = {
  id: string;
  roomId: string;
  createdAt: number;
  updatedAt: number;
  state: MatchState;
  topic: (typeof DEBATE_TOPICS)[number];
  coachingDeadlineAt: number | null;
  revealAt: number | null;
  players: MatchPlayerRecord[];
  turns: MatchTurn[];
  judgeResult: JudgeResult | null;
  events: MatchEvent[];
  executionJob: "idle" | "queued" | "running" | "complete";
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
  const store = getStore();
  const record = store.roomPlayers.get(roomPlayerKey(roomId, playerId));
  if (record) record.lastSeenAt = Date.now();
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
  });
  match.state = "agent_assigned";
}

function startCoaching(match: MatchRecord) {
  if (match.players.length !== 2 || !match.players.every((player) => player.readyAt)) return;
  if (!match.players.every((player) => player.agent)) {
    assignAgents(match);
  }
  match.state = "coaching_open";
  match.coachingDeadlineAt = Date.now() + 60_000;
  match.updatedAt = Date.now();
  addEvent(match, "coaching_started", "Coaching phase opened. You have 60 seconds.");
}

function maybeLockCoaching(match: MatchRecord) {
  if (match.state !== "coaching_open") return;
  const allSubmitted = match.players.every((player) => player.coachingSubmittedAt);
  const expired =
    typeof match.coachingDeadlineAt === "number" && Date.now() >= match.coachingDeadlineAt;
  if (!allSubmitted && !expired) return;
  match.state = "coaching_locked";
  match.updatedAt = Date.now();
  addEvent(match, "coaching_locked", "Coaching locked. The arena is about to resolve.");
  queueExecution(match.id);
}

function markDisconnectedPlayers(match: MatchRecord) {
  if (!["waiting_for_players", "agent_assigned", "coaching_open"].includes(match.state)) return;
  const store = getStore();
  for (const player of match.players) {
    const roomPlayer = store.roomPlayers.get(roomPlayerKey(match.roomId, player.playerId));
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

  if (match.state === "coaching_open") {
    const fullyGone = match.players.some(
      (player) => player.disconnectedSince && Date.now() - player.disconnectedSince > 60_000,
    );
    if (fullyGone) {
      match.state = "abandoned";
      match.updatedAt = Date.now();
      addEvent(match, "match_abandoned", "Room abandoned because a player disconnected during coaching.");
    }
  }
}

function coachingTextScore(text: string) {
  const lower = text.toLowerCase();
  let score = 0;
  if (text.length > 24) score += 4;
  if (text.length > 70) score += 4;
  if (/\bexample|evidence|specific|concrete\b/.test(lower)) score += 6;
  if (/\bcalm|disciplined|clear|tight|precise\b/.test(lower)) score += 5;
  if (/\battack|rebut|counter|flip|pressure\b/.test(lower)) score += 5;
  if (/\bavoid|don't|do not|stop|never\b/.test(lower)) score += 3;
  return score;
}

function evaluateCoaching(agentId: AgentAssignmentRecord["id"], coaching: CoachingInput | null) {
  const agent = getAgentDefinition(agentId);
  if (!coaching) {
    return {
      coachingQuality: -8,
      explanation: `${agent.name} got almost no useful coaching and defaulted to raw instinct.`,
    };
  }

  const totalText = [
    coaching.gamePlan,
    coaching.tone,
    coaching.whenAttacked,
    coaching.avoidThisMistake,
    coaching.secretNote ?? "",
  ].join(" ");

  let coachingQuality =
    coachingTextScore(coaching.gamePlan) +
    coachingTextScore(coaching.tone) +
    coachingTextScore(coaching.whenAttacked) +
    coachingTextScore(coaching.avoidThisMistake) * 1.2 +
    coachingTextScore(coaching.secretNote ?? "") * 0.5;

  const lower = totalText.toLowerCase();

  if (agentId === "Gremlin") {
    if (/\bone example|single example|stay focused|one thesis|short\b/.test(lower)) coachingQuality += 10;
    if (/\bchaos|wild|anything goes|ramble\b/.test(lower)) coachingQuality -= 8;
  }
  if (agentId === "Bruiser") {
    if (/\bshort|direct|one point|simple\b/.test(lower)) coachingQuality += 8;
    if (/\bnuanced|many angles|complex\b/.test(lower)) coachingQuality -= 7;
  }
  if (agentId === "Scholar") {
    if (/\bevidence|proof|calm|measured|facts\b/.test(lower)) coachingQuality += 9;
    if (/\baggressive|trash talk|swagger|mock\b/.test(lower)) coachingQuality -= 8;
  }
  if (agentId === "Showman") {
    if (/\bmemorable|one line|hook|big close|crowd\b/.test(lower)) coachingQuality += 9;
    if (/\bnever take risks|only facts|dry\b/.test(lower)) coachingQuality -= 7;
    if (/\bgrounded|don't overclaim|do not exaggerate|stay honest\b/.test(lower)) coachingQuality += 5;
  }

  coachingQuality = Math.round(coachingQuality * agent.promptSensitivity);

  const explanation =
    coachingQuality >= 18
      ? `${agent.name} got a tight game plan that matched its hidden upside.`
      : coachingQuality <= 2
        ? `${agent.name} never got clean instructions and tripped over its own flaw.`
        : `${agent.name} got usable coaching but still showed its natural limits.`;

  return { coachingQuality, explanation };
}

function createTurnText(args: {
  agentId: AgentAssignmentRecord["id"];
  playerName: string;
  coaching: CoachingInput | null;
  phase: MatchTurn["phase"];
  topicTitle: string;
  priorOpponentTurn: string | null;
  microScore: number;
}) {
  const { agentId, playerName, coaching, phase, topicTitle, priorOpponentTurn, microScore } = args;
  const agent = getAgentDefinition(agentId);
  const tone = coaching?.tone?.trim() || "improvised";
  const plan = coaching?.gamePlan?.trim() || "win by sheer nerve";
  const attack = coaching?.whenAttacked?.trim() || "hold the line and counter with one concrete example";
  const avoid = coaching?.avoidThisMistake?.trim() || "rambling";

  const openingLead: Record<AgentAssignmentRecord["id"], string[]> = {
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
      `The whole room can smell when an argument looks polished but collapses on contact.`,
    ],
  };

  const rebuttalLead: Record<AgentAssignmentRecord["id"], string[]> = {
    Bruiser: [
      `Their last shot sounded slick, but it dodged the real point.`,
      `That rebuttal moved fast and proved almost nothing.`,
    ],
    Gremlin: [
      `Cute line. Still misses the thing real people would notice first.`,
      `They gave you smoke. Here is the part with teeth.`,
    ],
    Scholar: [
      `The problem with that rebuttal is not tone. It is structure.`,
      `They answered the vibe of the claim, not the claim itself.`,
    ],
    Showman: [
      `That was a nice performance. I am here for the scoreboard.`,
      `They tried to win the camera angle and forgot to win the argument.`,
    ],
  };

  const closingLead: Record<AgentAssignmentRecord["id"], string[]> = {
    Bruiser: [
      `Final point: strip away the noise and the better side is obvious.`,
      `End of story. The stronger case is the one that survives contact with real life.`,
    ],
    Gremlin: [
      `Here is why this upset lands: the simpler argument is also the truer one.`,
      `This is the moment underdogs steal, because the room can feel which side actually held together.`,
    ],
    Scholar: [
      `To close, the winning case is the one with fewer leaps and cleaner incentives.`,
      `A good closing should not add drama. It should leave no loose ends.`,
    ],
    Showman: [
      `When the dust settles, one side still sounds brave and one side sounds right.`,
      `The closing question is simple: which argument would survive outside this room?`,
    ],
  };

  const leads =
    phase === "opening" ? openingLead[agentId] : phase === "rebuttal" ? rebuttalLead[agentId] : closingLead[agentId];
  const pickedLead = leads[microScore % leads.length]!;
  const opponentLine = priorOpponentTurn
    ? ` They leaned on "${priorOpponentTurn.slice(0, 86)}..." and that is exactly where the frame breaks.`
    : "";

  const qualityLine =
    microScore >= 78
      ? ` ${playerName}'s coaching kept the argument ${tone.toLowerCase()} and sharp: ${plan}.`
      : microScore <= 62
        ? ` ${playerName} aimed for ${tone.toLowerCase()}, but the execution kept slipping toward ${avoid.toLowerCase()}.`
        : ` The plan stayed visible: ${plan}, especially when pressure hit.`;

  const attackLine =
    phase !== "opening" ? ` Under pressure, the agent followed one rule: ${attack}.` : "";

  return `${pickedLead}${opponentLine}${qualityLine}${attackLine}`.slice(0, agent.responseBudget * 5);
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

async function resolveTurn(match: MatchRecord, player: MatchPlayerRecord, phase: MatchTurn["phase"]) {
  const agent = player.agent!;
  const playerName = currentPlayerName(player.playerId);
  const coachingResult = evaluateCoaching(agent.id, player.coaching);
  const priorOpponentTurn =
    phase === "opening"
      ? null
      : [...match.turns].reverse().find((turn) => turn.playerId !== player.playerId)?.content ?? null;
  const base = agent.expectedScore + coachingResult.coachingQuality * 0.8;
  const phaseModifier = phase === "opening" ? 0 : phase === "rebuttal" ? 4 : 2;
  const microScore = clamp(Math.round(base + phaseModifier), 45, 96);

  const openAiTurn = await callOpenAIJson<{ speech: string; microScore?: number }>(
    "You are generating one debate turn for an AI arena game. Return JSON with keys speech and microScore only.",
    JSON.stringify({
      topic: match.topic.prompt,
      phase,
      agent,
      coaching: player.coaching,
      priorOpponentTurn,
    }),
  );

  const content =
    openAiTurn?.speech?.trim() ||
    createTurnText({
      agentId: agent.id,
      playerName,
      coaching: player.coaching,
      phase,
      topicTitle: match.topic.title,
      priorOpponentTurn,
      microScore,
    });

  match.turns.push({
    id: randomId("turn"),
    phase,
    playerId: player.playerId,
    agentId: agent.id,
    content,
    microScore: clamp(openAiTurn?.microScore ?? microScore, 40, 98),
    createdAt: Date.now(),
  });
  addEvent(
    match,
    "turn_resolved",
    `${playerName}'s ${agent.id} finished the ${phase} with a ${microScore}-point round.`,
  );
}

function categoryScores(score: number, phasePeaks: number[]) {
  const spread = (offset: number) => clamp(Math.round(score + offset), 40, 99);
  return {
    clarity: spread(phasePeaks[0] - 3),
    relevance: spread(phasePeaks[1] - 2),
    rebuttal: spread(phasePeaks[2]),
    evidence: spread(phasePeaks[3] - 4),
    consistency: spread(phasePeaks[4] - 1),
  };
}

async function judgeMatch(match: MatchRecord) {
  const scoreMap: Record<string, number> = {};
  const categoryMap: JudgeResult["scoresByCategory"] = {};
  const perPlayerReasons: string[] = [];

  for (const player of match.players) {
    const turns = match.turns.filter((turn) => turn.playerId === player.playerId);
    const turnAverage = turns.reduce((sum, turn) => sum + turn.microScore, 0) / Math.max(turns.length, 1);
    const actual = clamp(Math.round(turnAverage), 40, 98);
    const agent = player.agent!;
    agent.actualScore = actual;
    agent.rigScore = actual - agent.expectedScore;
    agent.rigLabel = scoreLabel(agent.rigScore);
    scoreMap[player.playerId] = actual;
    categoryMap[player.playerId] = categoryScores(actual, [
      turns[0]?.microScore ?? actual,
      turns[1]?.microScore ?? actual,
      turns[1]?.microScore ?? actual,
      turns[0]?.microScore ?? actual,
      turns[2]?.microScore ?? actual,
    ]);
    perPlayerReasons.push(
      `${currentPlayerName(player.playerId)} pushed ${agent.id} to ${agent.rigLabel?.toLowerCase()} with ${evaluateCoaching(agent.id, player.coaching).explanation.toLowerCase()}`,
    );
  }

  const sorted = [...match.players].sort((left, right) => scoreMap[right.playerId]! - scoreMap[left.playerId]!);
  let winner = sorted[0]!;
  let confidence =
    0.7 + Math.min(0.24, Math.abs(scoreMap[sorted[0]!.playerId]! - scoreMap[sorted[1]!.playerId]!) / 100);

  const openAiJudge = await callOpenAIJson<{
    winnerPlayerId: string;
    reasonSummary: string;
    confidence: number;
    scoresByPlayer?: Record<string, number>;
  }>(
    "You are the strict judge for a two-player debate game. Return JSON with winnerPlayerId, reasonSummary, confidence, and optional scoresByPlayer.",
    JSON.stringify({
      topic: match.topic,
      turns: match.turns,
      players: match.players.map((player) => ({
        playerId: player.playerId,
        name: currentPlayerName(player.playerId),
        agent: player.agent,
      })),
    }),
  );

  if (openAiJudge?.winnerPlayerId && scoreMap[openAiJudge.winnerPlayerId] !== undefined) {
    winner = match.players.find((player) => player.playerId === openAiJudge.winnerPlayerId) ?? winner;
    confidence = clamp(openAiJudge.confidence ?? confidence, 0.5, 0.99);
    if (openAiJudge.scoresByPlayer) {
      for (const [playerId, score] of Object.entries(openAiJudge.scoresByPlayer)) {
        if (scoreMap[playerId] !== undefined) {
          scoreMap[playerId] = clamp(Math.round(score), 40, 99);
        }
      }
    }
  }

  const reasonSummary =
    openAiJudge?.reasonSummary?.trim() ||
    `${currentPlayerName(winner.playerId)} won because the argument stayed cleaner under pressure. ${perPlayerReasons.join(" ")}`;

  return {
    winnerPlayerId: winner.playerId,
    scoresByPlayer: scoreMap,
    scoresByCategory: categoryMap,
    reasonSummary,
    confidence: Number(Math.max(0.66, confidence).toFixed(2)),
  } satisfies JudgeResult;
}

async function runExecution(matchId: string) {
  const store = getStore();
  const match = store.matches.get(matchId);
  if (!match || match.executionJob === "running" || match.executionJob === "complete") return;
  match.executionJob = "running";
  match.state = "executing_match";
  match.updatedAt = Date.now();
  addEvent(match, "match_execution_started", "The stick fighters are in the arena.");

  const phases: MatchTurn["phase"][] = ["opening", "rebuttal", "closing"];
  for (const phase of phases) {
    for (const player of match.players) {
      await resolveTurn(match, player, phase);
    }
  }

  match.state = "judging";
  match.updatedAt = Date.now();
  match.judgeResult = await judgeMatch(match);
  addEvent(
    match,
    "judging_complete",
    `Judge confidence settled at ${(match.judgeResult.confidence * 100).toFixed(0)}%.`,
  );
  match.state = "reveal_ready";
  match.revealAt = Date.now();
  match.executionJob = "complete";
  match.updatedAt = Date.now();
  addEvent(match, "reveal_ready", "Reveal screen unlocked. Someone just rigged an upset.");
}

function queueExecution(matchId: string) {
  const match = getStore().matches.get(matchId);
  if (!match || match.executionJob !== "idle") return;
  match.executionJob = "queued";
  setTimeout(() => {
    runExecution(matchId).catch((error) => {
      const failedMatch = getStore().matches.get(matchId);
      if (!failedMatch) return;
      failedMatch.executionJob = "complete";
      failedMatch.state = "abandoned";
      addEvent(failedMatch, "match_abandoned", `Execution failed: ${(error as Error).message}`);
    });
  }, 50);
}

export function ensureProgress(matchId: string) {
  const match = getStore().matches.get(matchId);
  if (!match) return null;
  markDisconnectedPlayers(match);
  maybeLockCoaching(match);
  if (match.state === "reveal_ready" && match.revealAt && Date.now() - match.revealAt > 5_000) {
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

export function createRoom(hostPlayerId: string, origin: string) {
  const store = getStore();
  const room: RoomRecord = {
    id: randomId("room"),
    code: roomCode(),
    createdAt: Date.now(),
    hostPlayerId,
    playerIds: [hostPlayerId],
    activeMatchId: randomId("match"),
  };
  store.rooms.set(room.id, room);
  store.roomPlayers.set(roomPlayerKey(room.id, hostPlayerId), {
    roomId: room.id,
    playerId: hostPlayerId,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });

  const match: MatchRecord = {
    id: room.activeMatchId,
    roomId: room.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: "waiting_for_players",
    topic: shuffle(DEBATE_TOPICS)[0]!,
    coachingDeadlineAt: null,
    revealAt: null,
    players: [
      {
        playerId: hostPlayerId,
        readyAt: null,
        coaching: null,
        coachingSubmittedAt: null,
        disconnectedSince: null,
        agent: null,
      },
    ],
    turns: [],
    judgeResult: null,
    events: [],
    executionJob: "idle",
  };
  addEvent(match, "player_joined", `${currentPlayerName(hostPlayerId)} created room ${room.code}.`);
  store.matches.set(match.id, match);
  return buildSnapshot(room.id, hostPlayerId, origin);
}

export function joinRoomByCode(code: string, playerId: string, origin: string) {
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
      coaching: null,
      coachingSubmittedAt: null,
      disconnectedSince: null,
      agent: null,
    });
    addEvent(match, "player_joined", `${currentPlayerName(playerId)} joined the room.`);
  }
  return buildSnapshot(room.id, playerId, origin);
}

export function setReady(matchId: string, playerId: string, origin: string) {
  const match = ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  const room = getStore().rooms.get(match.roomId)!;
  const player = match.players.find((entry) => entry.playerId === playerId);
  if (!player) throw new Error("Player not in match.");
  heartbeat(room.id, playerId);
  player.readyAt = Date.now();
  addEvent(match, "player_ready", `${currentPlayerName(playerId)} is ready.`);
  if (match.players.length === 2 && match.players.every((entry) => entry.readyAt)) {
    startCoaching(match);
  }
  match.updatedAt = Date.now();
  return buildSnapshot(room.id, playerId, origin);
}

export function submitCoaching(matchId: string, playerId: string, coaching: CoachingInput, origin: string) {
  const match = ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  if (match.state !== "coaching_open") throw new Error("Coaching is closed.");
  const player = match.players.find((entry) => entry.playerId === playerId);
  if (!player) throw new Error("Player not in match.");
  if (player.coachingSubmittedAt) throw new Error("Coaching already submitted.");
  heartbeat(match.roomId, playerId);
  player.coaching = coaching;
  player.coachingSubmittedAt = Date.now();
  match.updatedAt = Date.now();
  addEvent(match, "coaching_countdown", `${currentPlayerName(playerId)} locked in a coaching plan.`);
  maybeLockCoaching(match);
  return buildSnapshot(match.roomId, playerId, origin);
}

export function buildSnapshot(roomId: string, viewerPlayerId: string | null, origin: string): MatchSnapshot {
  const room = getStore().rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  const match = ensureProgress(room.activeMatchId)!;
  if (viewerPlayerId && room.playerIds.includes(viewerPlayerId)) {
    heartbeat(room.id, viewerPlayerId);
  }
  return {
    room: {
      id: room.id,
      code: room.code,
      shareUrl: `${origin}/join/${room.code}`,
    },
    match: {
      id: match.id,
      state: match.state,
      topic: match.topic,
      coachingDeadlineAt: match.coachingDeadlineAt,
      startedAt: match.createdAt,
      revealAt: match.revealAt,
    },
    viewerPlayerId,
    players: match.players.map((player) => {
      const profile = getStore().players.get(player.playerId)!;
      const agent = player.agent ? getAgentDefinition(player.agent.id) : null;
      return {
        id: player.playerId,
        name: profile.name,
        ready: Boolean(player.readyAt),
        submittedCoaching: Boolean(player.coachingSubmittedAt),
        disconnected: Boolean(player.disconnectedSince),
        agent: agent
          ? {
              id: agent.id,
              name: agent.name,
              visibleTraits: agent.visibleTraits,
              flavor: agent.flavor,
              bandanaColor: agent.bandanaColor,
            }
          : null,
        expectedScore: player.agent?.expectedScore ?? null,
        actualScore: player.agent?.actualScore ?? null,
        rigScore: player.agent?.rigScore ?? null,
        rigLabel: player.agent?.rigLabel ?? null,
      };
    }),
    turnLog: [...match.turns],
    judgeResult: match.judgeResult,
    events: [...match.events].slice(0, 8),
  };
}

export function getMatchSnapshot(matchId: string, playerId: string | null, origin: string) {
  const match = ensureProgress(matchId);
  if (!match) throw new Error("Match not found.");
  return buildSnapshot(match.roomId, playerId, origin);
}

export function getReplay(matchId: string, playerId: string | null, origin: string) {
  const snapshot = getMatchSnapshot(matchId, playerId, origin);
  if (!snapshot.judgeResult) throw new Error("Replay is not ready yet.");
  return snapshot;
}

export function startRematch(roomId: string, origin: string) {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.playerIds.length !== 2) throw new Error("Rematch requires both players.");
  room.activeMatchId = randomId("match");
  const match: MatchRecord = {
    id: room.activeMatchId,
    roomId: room.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: "waiting_for_players",
    topic: shuffle(DEBATE_TOPICS)[0]!,
    coachingDeadlineAt: null,
    revealAt: null,
    players: room.playerIds.map((playerId) => ({
      playerId,
      readyAt: null,
      coaching: null,
      coachingSubmittedAt: null,
      disconnectedSince: null,
      agent: null,
    })),
    turns: [],
    judgeResult: null,
    events: [],
    executionJob: "idle",
  };
  addEvent(match, "player_joined", "Rematch room reset. New topic, new agents, same grudge.");
  store.matches.set(match.id, match);
  return buildSnapshot(room.id, room.playerIds[0]!, origin);
}
