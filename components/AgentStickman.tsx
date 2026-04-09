import { AgentId } from "@/lib/types";

type Pose = "idle" | "duel" | "victory" | "slump";
type Emphasis = "none" | "ring" | "burst" | "spotlight";

type Props = {
  color: string;
  variant?: AgentId;
  pose?: Pose;
  emphasis?: Emphasis;
  flipped?: boolean;
  className?: string;
};

const poseMap: Record<
  Pose,
  {
    head: number;
    torso: string;
    leftArm: string;
    rightArm: string;
    leftLeg: string;
    rightLeg: string;
  }
> = {
  idle: {
    head: 0,
    torso: "M80 54V94",
    leftArm: "M48 74L80 66",
    rightArm: "M80 66L112 74",
    leftLeg: "M80 94L62 128",
    rightLeg: "M80 94L98 128",
  },
  duel: {
    head: -4,
    torso: "M78 54V96",
    leftArm: "M46 80L78 66",
    rightArm: "M78 66L118 54",
    leftLeg: "M78 96L52 126",
    rightLeg: "M78 96L100 128",
  },
  victory: {
    head: 0,
    torso: "M80 54V92",
    leftArm: "M80 64L44 36",
    rightArm: "M80 64L118 32",
    leftLeg: "M80 92L60 126",
    rightLeg: "M80 92L102 126",
  },
  slump: {
    head: 7,
    torso: "M84 54V96",
    leftArm: "M52 86L84 76",
    rightArm: "M84 76L106 88",
    leftLeg: "M84 96L70 126",
    rightLeg: "M84 96L96 124",
  },
};

function Accessory({
  variant,
  color,
}: {
  variant: AgentId;
  color: string;
}) {
  if (variant === "Bruiser") {
    return (
      <>
        <path d="M30 74L44 66L52 84L34 90Z" fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round" />
        <path d="M104 56L122 48" stroke="#1e1b16" strokeWidth="5" strokeLinecap="round" />
      </>
    );
  }

  if (variant === "Gremlin") {
    return (
      <>
        <path
          d="M114 54L128 44L122 60L136 56L118 74"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M42 48L34 38L48 40" stroke={color} strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }

  if (variant === "Scholar") {
    return (
      <>
        <rect x="30" y="72" width="18" height="22" rx="3" fill="none" stroke={color} strokeWidth="4" />
        <path d="M70 26C72 20 88 20 90 26" stroke={color} strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }

  return (
    <>
      <path d="M112 38L118 52L132 54L120 62L124 76L112 68L100 76L104 62L92 54L106 52Z" fill={color} opacity="0.22" />
      <path d="M106 76L120 94" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function EmphasisLayer({
  emphasis,
  color,
}: {
  emphasis: Emphasis;
  color: string;
}) {
  if (emphasis === "ring") {
    return (
      <>
        <circle cx="80" cy="80" r="58" stroke={color} strokeWidth="4" opacity="0.2" />
        <circle cx="80" cy="80" r="70" stroke={color} strokeWidth="2" opacity="0.12" strokeDasharray="6 8" />
      </>
    );
  }

  if (emphasis === "burst") {
    return (
      <>
        <path d="M80 10L84 28" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.4" />
        <path d="M122 22L112 38" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.4" />
        <path d="M146 62L128 66" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.4" />
        <path d="M18 62L36 66" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.4" />
        <path d="M38 20L50 36" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      </>
    );
  }

  if (emphasis === "spotlight") {
    return (
      <>
        <path d="M52 12H108L126 146H34Z" fill={color} opacity="0.08" />
        <circle cx="80" cy="80" r="60" stroke={color} strokeWidth="3" opacity="0.12" />
      </>
    );
  }

  return null;
}

export function AgentStickman({
  color,
  variant = "Bruiser",
  pose = "idle",
  emphasis = "none",
  flipped = false,
  className,
}: Props) {
  const body = poseMap[pose];

  return (
    <svg
      className={className ?? "agent-stickman"}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
    >
      <EmphasisLayer emphasis={emphasis} color={color} />
      <g transform={flipped ? "translate(160 0) scale(-1 1)" : undefined}>
        <g transform={`rotate(${body.head} 80 32)`}>
          <circle cx="80" cy="32" r="14" stroke="#1e1b16" strokeWidth="5" />
          <path d="M64 27C74 16 87 16 96 27" stroke={color} strokeWidth="6" strokeLinecap="round" />
        </g>
        <path d={body.torso} stroke="#1e1b16" strokeWidth="5" strokeLinecap="round" />
        <path d={body.leftArm} stroke="#1e1b16" strokeWidth="5" strokeLinecap="round" />
        <path d={body.rightArm} stroke="#1e1b16" strokeWidth="5" strokeLinecap="round" />
        <path d={body.leftLeg} stroke="#1e1b16" strokeWidth="5" strokeLinecap="round" />
        <path d={body.rightLeg} stroke="#1e1b16" strokeWidth="5" strokeLinecap="round" />
        <Accessory variant={variant} color={color} />
        <path d="M72 38H88" stroke="#1e1b16" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      </g>
    </svg>
  );
}
