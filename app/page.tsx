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
            <span className="eyebrow">Rig D Agent</span>
            <h1 className="title">Coach the wrong fighter into the right win.</h1>
            <p className="subtitle">
              A private 1v1 stick-fighter debate arena where the best feeling is turning the unstable side into the
              dangerous one.
            </p>
            <div className="hero-actions hero-actions--subtle">
              <Link className="ghost-button" href="#fighters">
                Meet the fighters
              </Link>
              <Link className="ghost-button" href="/how-it-works">
                Game details
              </Link>
            </div>
          </div>
          <LandingArenaScene />
        </div>

        <aside className="surface surface--secondary entry-module entry-module--compact">
          <div className="entry-module__header">
            <span className="pill">Enter The Arena</span>
            <h2 className="section-title">Start fast</h2>
            <p className="muted">Host a room or jump into an invite. The mechanics can wait until after the click.</p>
          </div>

          <div className="entry-stack">
            <section className="cta-card cta-card--entry">
              <div className="cta-copy">
                <span className="pill">Host</span>
                <h3 className="section-title">Create a private room</h3>
              </div>
              <CreateRoomForm />
            </section>

            <section className="cta-card cta-card--entry cta-card--secondary">
              <div className="cta-copy">
                <span className="pill">Join</span>
                <h3 className="section-title">Use an invite code</h3>
              </div>
              <HomeJoinForm />
            </section>
          </div>
        </aside>
      </section>

      <section className="section-grid landing-proof">
        <article className="surface surface--secondary panel panel--wide">
          <div className="section-heading">
            <h2 className="section-title">Why this lands fast</h2>
            <p className="muted">
              The room works because the mismatch is visible immediately and the payoff is legible when the reveal
              shows who actually outperformed expectation.
            </p>
          </div>
          <div className="proof-grid">
            <div className="proof-card">
              <small>Visible tension</small>
              <strong>One side looks favored</strong>
              <p>The matchup gives the round a story before anyone types a word.</p>
            </div>
            <div className="proof-card">
              <small>Short pressure</small>
              <strong>Only one minute to coach</strong>
              <p>The constraint keeps the game sharp instead of turning into prompt homework.</p>
            </div>
            <div className="proof-card">
              <small>Real payoff</small>
              <strong>Rig Score names the real flex</strong>
              <p>Winning matters, but stealing expectation is what players remember.</p>
            </div>
          </div>
        </article>

        <article className="surface surface--utility panel panel--side landing-detail-card">
          <h2 className="section-title">Need the mechanics?</h2>
          <p className="muted">
            Full loop, scoring logic, and MVP rules are moved off the landing page so the homepage can stay focused on
            the idea and the first action.
          </p>
          <Link className="button" href="/how-it-works">
            Open game details
          </Link>
        </article>
      </section>

      <section className="surface surface--secondary panel landing-roster" id="fighters">
        <div className="section-heading">
          <h2 className="section-title">Meet the fighters</h2>
          <p className="muted">
            Each archetype is readable at a glance. The skill ceiling comes from figuring out which weakness can be
            turned into a weapon.
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
