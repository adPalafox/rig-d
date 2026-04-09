export type MatchState =
  | "room_open"
  | "waiting_for_players"
  | "agent_assigned"
  | "coaching_open"
  | "coaching_locked"
  | "executing_match"
  | "judging"
  | "reveal_ready"
  | "completed"
  | "abandoned";

export type AgentId = "Bruiser" | "Gremlin" | "Scholar" | "Showman";
export type DebatePhase = "opening" | "rebuttal" | "closing";

export type AgentDefinition = {
  id: AgentId;
  name: string;
  baselineScore: number;
  promptSensitivity: number;
  visibleTraits: string[];
  hiddenUpside: string;
  hiddenFlaw: string;
  responseBudget: number;
  flavor: string;
  bandanaColor: string;
};

export type DebateTopic = {
  id: string;
  title: string;
  prompt: string;
  difficultyAdjustment: number;
  tags: string[];
};

export type CoachingInput = {
  gamePlan: string;
  tone: string;
  whenAttacked: string;
  avoidThisMistake: string;
  secretNote?: string;
};

export type MatchEventType =
  | "player_joined"
  | "player_ready"
  | "coaching_started"
  | "coaching_countdown"
  | "coaching_locked"
  | "match_execution_started"
  | "turn_resolved"
  | "judging_complete"
  | "reveal_ready"
  | "player_disconnected"
  | "match_abandoned";

export type MatchEvent = {
  id: string;
  type: MatchEventType;
  message: string;
  createdAt: number;
};

export type MatchTurn = {
  id: string;
  phase: DebatePhase;
  playerId: string;
  agentId: AgentId;
  content: string;
  microScore: number;
  createdAt: number;
};

export type JudgeResult = {
  winnerPlayerId: string;
  scoresByPlayer: Record<string, number>;
  scoresByCategory: Record<
    string,
    {
      clarity: number;
      relevance: number;
      rebuttal: number;
      evidence: number;
      consistency: number;
    }
  >;
  reasonSummary: string;
  confidence: number;
};

export type MatchSnapshot = {
  room: {
    id: string;
    code: string;
    shareUrl: string;
  };
  match: {
    id: string;
    state: MatchState;
    topic: DebateTopic;
    coachingDeadlineAt: number | null;
    startedAt: number;
    revealAt: number | null;
  };
  viewerPlayerId: string | null;
  players: Array<{
    id: string;
    name: string;
    ready: boolean;
    submittedCoaching: boolean;
    disconnected: boolean;
    agent: {
      id: AgentId;
      name: string;
      visibleTraits: string[];
      flavor: string;
      bandanaColor: string;
    } | null;
    expectedScore: number | null;
    actualScore: number | null;
    rigScore: number | null;
    rigLabel: string | null;
  }>;
  turnLog: MatchTurn[];
  judgeResult: JudgeResult | null;
  events: MatchEvent[];
};
