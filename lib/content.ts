import { AgentDefinition, DebateTopic } from "@/lib/types";

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "Bruiser",
    name: "Bruiser",
    baselineScore: 78,
    promptSensitivity: 0.75,
    visibleTraits: ["Direct pressure", "Short arguments", "Predictable rhythm"],
    hiddenUpside: "Excels when the plan is brutally narrow and specific.",
    hiddenFlaw: "Repeats itself if fed too many instructions.",
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

export function getAgentDefinition(agentId: AgentDefinition["id"]) {
  return AGENT_DEFINITIONS.find((agent) => agent.id === agentId)!;
}
