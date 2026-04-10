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
    visibleTraits: ["Crashes forward", "Body-shot bully", "Bad brakes"],
    hiddenUpside: "Excels when the plan is brutally narrow and specific.",
    hiddenFlaw: "Runs hot and can punch itself out.",
    publicHint: "Point it straight at the chest and let it keep walking.",
    publicDanger: "If you keep screaming for more, it starts throwing itself off balance.",
    responseBudget: 110,
    flavor: "Cardboard shield, taped fists, too stubborn to panic.",
    bandanaColor: "#d14b32",
  },
  {
    id: "Gremlin",
    name: "Gremlin",
    baselineScore: 58,
    promptSensitivity: 1.35,
    visibleTraits: ["Weird angles", "Chaos feints", "Cheap laughs"],
    hiddenUpside: "Becomes dangerous when told to harass from one goofy angle and keep it alive.",
    hiddenFlaw: "Falls apart when the corner encourages random nonsense.",
    publicHint: "Keep it annoying, mobile, and circling one trick the crowd can recognize.",
    publicDanger: "If you mash chaos for chaos, it loses the room and trips over itself.",
    responseBudget: 120,
    flavor: "Loose headband, marker sword, suspicious confidence.",
    bandanaColor: "#2e9159",
  },
  {
    id: "Scholar",
    name: "Scholar",
    baselineScore: 69,
    promptSensitivity: 1.05,
    visibleTraits: ["Sharp guard", "Reads openings", "No wasted motion"],
    hiddenUpside: "Rewards patience, reset calls, and punishing the next mistake cleanly.",
    hiddenFlaw: "Gets ugly when pushed into clowning.",
    publicHint: "Tell it when to plant, block, and punish. It wins by looking in control.",
    publicDanger: "If you force swagger and chaos, it forgets how to steer.",
    responseBudget: 125,
    flavor: "Book tucked under one arm, taped glasses, neat footwork.",
    bandanaColor: "#2075c7",
  },
  {
    id: "Showman",
    name: "Showman",
    baselineScore: 71,
    promptSensitivity: 1.1,
    visibleTraits: ["Crowd-baiting", "Flash counters", "Dangerous finishes"],
    hiddenUpside: "Steals momentum when the corner knows exactly when to pop the room.",
    hiddenFlaw: "Will absolutely overcook a moment if you keep feeding it attention.",
    publicHint: "Save the big pose for the right swing and let the room work for you.",
    publicDanger: "Too much showboating turns a hot streak into a pratfall.",
    responseBudget: 130,
    flavor: "Gold sash, oversized grin, absolutely playing to the crowd.",
    bandanaColor: "#db9f17",
  },
];

export const DEBATE_TOPICS: DebateTopic[] = [
  {
    id: "topic-city",
    title: "Downtown Car Ban",
    prompt: "The crowd is yelling about banning private cars from downtown. Turn the room with swagger, not policy detail.",
    difficultyAdjustment: 0,
    tags: ["urban", "policy", "scrappy"],
  },
  {
    id: "topic-homework",
    title: "Optional Homework",
    prompt: "The room is split on optional homework. Make one side look weak and one side look alive.",
    difficultyAdjustment: -3,
    tags: ["education", "high-emotion", "simple"],
  },
  {
    id: "topic-remote",
    title: "Remote Work Kills Creativity",
    prompt: "The crowd is debating remote work and creativity. Sell a clean angle and make the other side flinch.",
    difficultyAdjustment: 2,
    tags: ["work", "tradeoffs", "moderate"],
  },
  {
    id: "topic-ai",
    title: "AI In Every Classroom",
    prompt: "The room is hot over AI in school. Turn the panic or the hype into your fighter’s rhythm.",
    difficultyAdjustment: 1,
    tags: ["ai", "education", "hot-take"],
  },
  {
    id: "topic-shortform",
    title: "Short-Form Video Ruins Brains",
    prompt: "The crowd is already loud about short-form video. Feed the ring one clear angle and keep the energy ugly.",
    difficultyAdjustment: 1,
    tags: ["culture", "behavior", "punchy"],
  },
];

export const OPENING_STYLE_OPTIONS: SetupOption<OpeningStyle>[] = [
  {
    id: "fast_start",
    label: "Crash Out",
    description: "Take the center early and make the room feel the heat immediately.",
  },
  {
    id: "measured",
    label: "Stay Tall",
    description: "Claim space slowly, read the chaos, and start from control.",
  },
  {
    id: "needle",
    label: "Pester",
    description: "Work one annoying angle until the other side breaks shape.",
  },
  {
    id: "showboat",
    label: "Grand Entrance",
    description: "Open loud and try to own the crowd before the punches even settle.",
  },
];

export const PRESSURE_RULE_OPTIONS: SetupOption<PressureRule>[] = [
  {
    id: "counter_first",
    label: "Make Them Miss",
    description: "Let the other side fly first, then slap them for it.",
  },
  {
    id: "reset_frame",
    label: "Reset The Feet",
    description: "Any time the room gets wild, pull the fighter back into stance.",
  },
  {
    id: "trade_shots",
    label: "Stay In It",
    description: "Answer noise with noise and trust the chin to hold.",
  },
  {
    id: "stay_grounded",
    label: "Don’t Drift",
    description: "Keep the fighter planted and make every move look deliberate.",
  },
];

export const RISK_LEVEL_OPTIONS: SetupOption<RiskLevel>[] = [
  {
    id: "composed",
    label: "Safe Hands",
    description: "Less chaos, cleaner recoveries, fewer wild swings.",
  },
  {
    id: "pressing",
    label: "Heat Check",
    description: "Push the pace, but leave enough gas to pull back.",
  },
  {
    id: "all_in",
    label: "Go Stupid",
    description: "Huge swing potential with a real chance of embarrassing collapse.",
  },
];

export const LIVE_COMMAND_DEFINITIONS: LiveCommandDefinition[] = [
  {
    id: "rush_in",
    label: "Rush In",
    cost: 1,
    description: "Crash forward and try to bully the ring before the other side sets.",
  },
  {
    id: "back_off",
    label: "Back Off",
    cost: 1,
    description: "Pull the fighter out of danger and stop the spiral.",
  },
  {
    id: "slip_counter",
    label: "Slip Counter",
    cost: 1,
    description: "Make the other side whiff and snap back with a quick answer.",
  },
  {
    id: "cover_up",
    label: "Cover Up",
    cost: 1,
    description: "Shell up, survive the burst, and buy one breath.",
  },
  {
    id: "showboat",
    label: "Showboat",
    cost: 2,
    description: "Play to the crowd for a hype spike and risk leaving the chin hanging.",
  },
  {
    id: "plant_your_feet",
    label: "Plant Your Feet",
    cost: 2,
    description: "Stand the fighter up and turn panic into posture.",
  },
  {
    id: "stick_the_jab",
    label: "Stick The Jab",
    cost: 2,
    description: "Keep poking the same spot until the room starts believing it.",
  },
  {
    id: "go_for_the_bell",
    label: "Go For The Bell",
    cost: 3,
    description: "Swing huge for a finish and accept the chance of eating canvas.",
  },
];

export function getAgentDefinition(agentId: AgentDefinition["id"]) {
  return AGENT_DEFINITIONS.find((agent) => agent.id === agentId)!;
}

export function getLiveCommandDefinition(commandId: LiveCommandDefinition["id"]) {
  return LIVE_COMMAND_DEFINITIONS.find((command) => command.id === commandId)!;
}
