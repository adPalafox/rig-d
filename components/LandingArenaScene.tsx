import { AgentStickman } from "@/components/AgentStickman";

export function LandingArenaScene() {
  return (
    <div className="arena-scene">
      <div className="arena-scene__tags">
        <span className="pill">Heavy Favorite</span>
        <span className="pill">Your Underdog</span>
      </div>
      <div className="arena-scene__fighters">
        <div className="arena-fighter arena-fighter--favorite">
          <AgentStickman
            className="agent-stickman agent-stickman--scene"
            color="#d14b32"
            variant="Bruiser"
            pose="duel"
            emphasis="ring"
          />
          <div className="arena-fighter__label">
            <strong>Bruiser</strong>
            <span>Wins on paper</span>
          </div>
        </div>
        <div className="arena-fighter arena-fighter--underdog">
          <AgentStickman
            className="agent-stickman agent-stickman--scene"
            color="#2e9159"
            variant="Gremlin"
            pose="victory"
            emphasis="burst"
            flipped
          />
          <div className="arena-fighter__label">
            <strong>Gremlin</strong>
            <span>Steals the room with better coaching</span>
          </div>
        </div>
      </div>
      <div className="arena-scene__floor">
        <span>Coach the unstable side.</span>
        <strong>Rig Score decides who truly overperformed.</strong>
      </div>
    </div>
  );
}
