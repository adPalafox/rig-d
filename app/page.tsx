import Link from "next/link";
import { ArchetypeRosterCard } from "@/components/ArchetypeRosterCard";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { HomeJoinForm } from "@/components/HomeJoinForm";
import { LandingArenaScene } from "@/components/LandingArenaScene";
import { AGENT_DEFINITIONS } from "@/lib/content";

export default function HomePage() {
  return (
    <main className="page-shell landing-shell">
      <section className="landing-hero">
        <div className="surface surface--primary hero-card hero-card--landing">
          <div className="hero-copy hero-copy--landing">
            <span className="kicker">Rig D Agent</span>
            <h1 className="title">Coach the wrong fighter into the right win.</h1>
            <p className="subtitle">
              A private 1v1 stick-fighter room where the setup is brief, the corner gets loud, and the ring visibly
              lurches every time you bark the right call.
            </p>
            <div className="hero-actions hero-actions--subtle">
              <Link className="ghost-button" href="#fighters">
                Meet the fighters
              </Link>
              <Link className="button" href="/how-it-works">
                Game details
              </Link>
            </div>
          </div>
          <LandingArenaScene />
        </div>

        <aside className="surface surface--secondary entry-module">
          <div className="entry-module__header">
            <h2 className="section-title">Start fast</h2>
            <p className="muted">Host a room or jump into an invite. The mechanics can wait until after the click.</p>
          </div>

          <div className="entry-stack">
            <section className="cta-card cta-card--entry">
              <div className="cta-copy">
                <h3 className="section-title">Use an invite code (Join)</h3>
              </div>
              <HomeJoinForm />
            </section>

            <section className="cta-card cta-card--entry cta-card--secondary">
              <div className="cta-copy">
                <h3 className="section-title">Create a private room (Host)</h3>
              </div>
              <CreateRoomForm />
            </section>

          </div>
        </aside>
      </section>

      <section className="surface surface--secondary panel landing-roster" id="fighters">
        <div className="section-heading">
          <h2 className="section-title">Meet the fighters</h2>
          <p className="muted">
            Each archetype is readable at a glance. The skill ceiling comes from figuring out which unstable little
            menace you can drag through the room without watching it self-destruct.
          </p>
        </div>
        <div className="roster-showcase-grid">
          {AGENT_DEFINITIONS.map((agent) => (
            <ArchetypeRosterCard agent={agent} key={agent.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
