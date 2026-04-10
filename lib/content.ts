import {
  AgentDefinition,
  DebateTopic,
  LiveCommandDefinition,
  OpeningStyle,
  PressureRule,
  RiskLevel,
  SetupOption,
} from "@/lib/types";

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "Bruiser",
    name: "Bruiser",
    baselineScore: 78,
    promptSensitivity: 0.75,
    visibleTraits: ["Direct pressure", "Short arguments", "Predictable rhythm"],
    hiddenUpside: "Excels when the plan is brutally narrow and specific.",
    hiddenFlaw: "Repeats itself if fed too many instructions.",
    publicHint: "Give it one lane, one target, and let it drive through people.",
    publicDanger: "If you keep changing the ask, it starts sounding flat and repetitive.",
    responseBudget: 110,
    flavor: "Cardboard shield, taped fists, too stubborn to panic.",
    bandanaColor: "#d14b32",
  },
  {
    id: "Gremlin",
    name: "Gremlin",
    baselineScore: 58,
    promptSensitivity: 1.35,
    visibleTraits: ["Creative pivots", "Chaotic energy", "Underdog spikes"],
    hiddenUpside: "Becomes dangerous when told to use one vivid example and stick to it.",
    hiddenFlaw: "Rambles if the player does not impose structure.",
    publicHint: "Anchor it to one concrete image and let the chaos orbit around that.",
    publicDanger: "If you encourage random swings, it loses the room fast.",
    responseBudget: 120,
    flavor: "Loose headband, marker sword, suspicious confidence.",
    bandanaColor: "#2e9159",
  },
  {
    id: "Scholar",
    name: "Scholar",
    baselineScore: 69,
    promptSensitivity: 1.05,
    visibleTraits: ["Precise framing", "Evidence-friendly", "Low swagger"],
    hiddenUpside: "Rewards calm, evidence-first coaching with sharp rebuttals.",
    hiddenFlaw: "Loses force when pushed into aggressive bravado.",
    publicHint: "Keep it factual, calm, and ruthless about structure.",
    publicDanger: "If you demand swagger and heat, it drops its edge.",
    responseBudget: 125,
    flavor: "Book tucked under one arm, taped glasses, neat footwork.",
    bandanaColor: "#2075c7",
  },
  {
    id: "Showman",
    name: "Showman",
    baselineScore: 71,
    promptSensitivity: 1.1,
    visibleTraits: ["Big closings", "Memorable phrasing", "Risky confidence"],
    hiddenUpside: "Steals rounds if the player channels flair into one crisp thesis.",
    hiddenFlaw: "Overclaims when not explicitly told to stay grounded.",
    publicHint: "Feed it one big image and a cleaner closer than the other side can answer.",
    publicDanger: "If you only ask for hype, it starts inventing too much.",
    responseBudget: 130,
    flavor: "Gold sash, oversized grin, absolutely playing to the crowd.",
    bandanaColor: "#db9f17",
  },
];

export const DEBATE_TOPICS: DebateTopic[] = [
  {
    id: "topic-city",
    title: "Cities Should Ban Cars From Downtown",
    prompt:
      "Argue either for or against banning private cars from downtown cores. Win by being more convincing, not by sounding more technical.",
    difficultyAdjustment: 0,
    tags: ["urban", "policy", "punchy"],
  },
  {
    id: "topic-homework",
    title: "Homework Should Be Optional",
    prompt:
      "Argue either for or against making homework optional in schools. Strong examples beat abstract slogans.",
    difficultyAdjustment: -3,
    tags: ["education", "high-emotion", "simple"],
  },
  {
    id: "topic-remote",
    title: "Remote Work Hurts Team Creativity",
    prompt:
      "Argue either for or against the claim that remote work hurts team creativity. Address both productivity and human behavior.",
    difficultyAdjustment: 2,
    tags: ["work", "tradeoffs", "moderate"],
  },
  {
    id: "topic-ai",
    title: "AI Tools Should Be Allowed In Every Classroom",
    prompt:
      "Argue either for or against allowing AI tools in every classroom. Use concrete outcomes and answer the strongest concern from the other side.",
    difficultyAdjustment: 1,
    tags: ["ai", "education", "hot-take"],
  },
  {
    id: "topic-shortform",
    title: "Short-Form Video Makes People Worse Thinkers",
    prompt:
      "Argue either for or against the claim that short-form video makes people worse thinkers. Be vivid and disciplined.",
    difficultyAdjustment: 1,
    tags: ["culture", "behavior", "punchy"],
  },
];

export const OPENING_STYLE_OPTIONS: SetupOption<OpeningStyle>[] = [
  {
    id: "fast_start",
    label: "Fast Start",
    description: "Kick the door in early and try to steal the first impression.",
  },
  {
    id: "measured",
    label: "Measured",
    description: "Start clean, set the frame, and build pressure without overreaching.",
  },
  {
    id: "needle",
    label: "Needle",
    description: "Open with one sharp point that keeps poking the same weak spot.",
  },
  {
    id: "showboat",
    label: "Showboat",
    description: "Go big for the crowd and risk blowing the lane open.",
  },
];

export const PRESSURE_RULE_OPTIONS: SetupOption<PressureRule>[] = [
  {
    id: "counter_first",
    label: "Counter First",
    description: "Let the other side expose itself, then punish the gap.",
  },
  {
    id: "reset_frame",
    label: "Reset Frame",
    description: "Whenever things get messy, drag the fight back to your thesis.",
  },
  {
    id: "trade_shots",
    label: "Trade Shots",
    description: "Answer heat with heat and trust the fighter to stand in it.",
  },
  {
    id: "stay_grounded",
    label: "Stay Grounded",
    description: "Keep every exchange anchored to something concrete and believable.",
  },
];

export const RISK_LEVEL_OPTIONS: SetupOption<RiskLevel>[] = [
  {
    id: "composed",
    label: "Composed",
    description: "Lower volatility, cleaner floor, fewer hero plays.",
  },
  {
    id: "pressing",
    label: "Pressing",
    description: "Push the pace without fully emptying the gas tank.",
  },
  {
    id: "all_in",
    label: "All In",
    description: "Huge swing potential with a real chance of self-destruction.",
  },
];

export const LIVE_COMMAND_DEFINITIONS: LiveCommandDefinition[] = [
  {
    id: "push",
    label: "Push",
    cost: 1,
    description: "Turn up the pressure and force the other side to answer now.",
  },
  {
    id: "reset",
    label: "Reset",
    cost: 1,
    description: "Calm the fighter down and return to the main frame.",
  },
  {
    id: "counter",
    label: "Counter",
    cost: 1,
    description: "Punish the last opening instead of starting a new tangent.",
  },
  {
    id: "stay_tight",
    label: "Stay Tight",
    cost: 1,
    description: "Shorten the answer and trim away any wobble.",
  },
  {
    id: "crowd_pleaser",
    label: "Crowd Pleaser",
    cost: 2,
    description: "Go for a louder line and try to grab the room.",
  },
  {
    id: "ground_it",
    label: "Ground It",
    cost: 2,
    description: "Anchor the argument before the fighter starts floating.",
  },
  {
    id: "one_example",
    label: "One Example",
    cost: 2,
    description: "Force the fighter to keep circling one vivid example.",
  },
  {
    id: "big_finish",
    label: "Big Finish",
    cost: 3,
    description: "Spend heavy for a closing swing that can either land or backfire.",
  },
];

export function getAgentDefinition(agentId: AgentDefinition["id"]) {
  return AGENT_DEFINITIONS.find((agent) => agent.id === agentId)!;
}

export function getLiveCommandDefinition(commandId: LiveCommandDefinition["id"]) {
  return LIVE_COMMAND_DEFINITIONS.find((command) => command.id === commandId)!;
}
