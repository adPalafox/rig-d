import { AgentStickman } from "@/components/AgentStickman";
import { AgentDefinition } from "@/lib/types";

type Props = {
  agent: AgentDefinition;
};

const poseMap: Record<AgentDefinition["id"], "duel" | "victory" | "idle"> = {
  Bruiser: "duel",
  Gremlin: "victory",
  Scholar: "idle",
  Showman: "victory",
};

export function ArchetypeRosterCard({ agent }: Props) {
  return (
    <article className={`agent-card roster-showcase agent-card--${agent.id}`}>
      <div className="roster-showcase__visual">
        <AgentStickman
          className="agent-stickman agent-stickman--roster"
          color={agent.bandanaColor}
          variant={agent.id}
          pose={poseMap[agent.id]}
          emphasis="ring"
        />
      </div>
      <div className="roster-showcase__copy">
        <div>
          <small>Archetype</small>
          <h3>{agent.name}</h3>
        </div>
        <p>{agent.flavor}</p>
        <div className="trait-row">
          {agent.visibleTraits.map((trait) => (
            <span className="trait-tag" key={trait}>
              {trait}
            </span>
          ))}
        </div>
        <p>
          <strong>Coaching reward:</strong> {agent.hiddenUpside}
        </p>
      </div>
    </article>
  );
}
