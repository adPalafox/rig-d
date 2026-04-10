export type MatchState =
  | "waiting_for_players"
  | "setup_open"
  | "live_phase_open"
  | "judging"
  | "reveal_ready"
  | "completed"
  | "abandoned";

export type AgentId = "Bruiser" | "Gremlin" | "Scholar" | "Showman";
export type DebatePhase = "opening" | "rebuttal" | "closing";
export type OpeningStyle = "fast_start" | "measured" | "needle" | "showboat";
export type PressureRule = "counter_first" | "reset_frame" | "trade_shots" | "stay_grounded";
export type RiskLevel = "composed" | "pressing" | "all_in";

export type FighterState =
  | "advancing"
  | "rocked"
  | "guarded"
  | "overextended"
  | "recovering"
  | "crowd_favorite";

export type FighterAction =
  | "idle"
  | "jab"
  | "lunge"
  | "recoil"
  | "block"
  | "stumble"
  | "taunt"
  | "exhausted"
  | "ringout_pressure";

export type ImpactType = "hit" | "whiff" | "block" | "hype" | "recovery" | "crash";

export type AgentDefinition = {
  id: AgentId;
  name: string;
  baselineScore: number;
  promptSensitivity: number;
  visibleTraits: string[];
  hiddenUpside: string;
  hiddenFlaw: string;
  publicHint: string;
  publicDanger: string;
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

export type SetupPlan = {
  openingStyle: OpeningStyle;
  pressureRule: PressureRule;
  riskLevel: RiskLevel;
  signatureLine?: string;
};

export type SetupOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

export type LiveCommandId =
  | "rush_in"
  | "back_off"
  | "slip_counter"
  | "cover_up"
  | "showboat"
  | "plant_your_feet"
  | "stick_the_jab"
  | "go_for_the_bell";

export type LiveCommandDefinition = {
  id: LiveCommandId;
  label: string;
  cost: number;
  description: string;
};

export type MatchEventType =
  | "player_joined"
  | "player_ready"
  | "setup_started"
  | "setup_submitted"
  | "setup_locked"
  | "live_phase_started"
  | "command_used"
  | "arena_beat_resolved"
  | "live_phase_locked"
  | "turn_resolved"
  | "momentum_updated"
  | "judging_complete"
  | "decisive_moment_found"
  | "reveal_ready"
  | "player_disconnected"
  | "match_abandoned";

export type MatchEvent = {
  id: string;
  type: MatchEventType;
  message: string;
  createdAt: number;
};

export type MatchCommand = {
  id: string;
  phase: DebatePhase;
  playerId: string;
  playerName: string;
  agentId: AgentId;
  commandId: LiveCommandId;
  label: string;
  cost: number;
  energyAfter: number;
  createdAt: number;
};

export type ArenaBeat = {
  id: string;
  phase: DebatePhase;
  beatNumber: number;
  playerId: string;
  playerName: string;
  agentId: AgentId;
  commandId: LiveCommandId;
  commandLabel: string;
  fighterState: FighterState;
  fighterAction: FighterAction;
  ringPosition: number;
  staggerLevel: number;
  hypeLevel: number;
  impactType: ImpactType;
  swingTag: string;
  commentary: string;
  createdAt: number;
};

export type MomentumPoint = {
  id: string;
  phase: DebatePhase;
  playerId: string;
  playerName: string;
  commandId: LiveCommandId;
  commandLabel: string;
  value: number;
  swingTag: string;
  createdAt: number;
};

export type MatchTurn = {
  id: string;
  phase: DebatePhase;
  playerId: string;
  playerName: string;
  agentId: AgentId;
  content: string;
  microScore: number;
  swingTag: string;
  momentumDelta: number;
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
  decisiveMoment: {
    playerId: string;
    playerName: string;
    phase: DebatePhase;
    commands: LiveCommandId[];
    summary: string;
    swingValue: number;
  } | null;
  coachingImpactSummary: string;
};

export type MatchSnapshot = {
  room: {
    id: string;
    code: string;
    shareUrl: string;
    rivalry: {
      roundsPlayed: number;
      currentStreakPlayerId: string | null;
      currentStreakCount: number;
      winsByPlayer: Record<string, number>;
    };
  };
  match: {
    id: string;
    state: MatchState;
    topic: DebateTopic;
    setupDeadlineAt: number | null;
    phaseDeadlineAt: number | null;
    currentPhase: DebatePhase | null;
    startedAt: number;
    revealAt: number | null;
    currentBeat: number;
  };
  viewerPlayerId: string | null;
  players: Array<{
    id: string;
    name: string;
    ready: boolean;
    submittedSetup: boolean;
    disconnected: boolean;
    setupPlan: SetupPlan | null;
    agent: {
      id: AgentId;
      name: string;
      visibleTraits: string[];
      flavor: string;
      bandanaColor: string;
      publicHint: string;
      publicDanger: string;
    } | null;
    expectedScore: number | null;
    actualScore: number | null;
    rigScore: number | null;
    rigLabel: string | null;
    cornerEnergy: number;
    lastCommandAt: number | null;
    activeCommandFeed: MatchCommand[];
    momentum: number;
    fighterState: FighterState;
    fighterAction: FighterAction;
    ringPosition: number;
    staggerLevel: number;
    hypeLevel: number;
    lastImpactType: ImpactType;
  }>;
  turnLog: MatchTurn[];
  commandFeed: MatchCommand[];
  momentumTimeline: MomentumPoint[];
  arenaTimeline: ArenaBeat[];
  judgeResult: JudgeResult | null;
  events: MatchEvent[];
};
