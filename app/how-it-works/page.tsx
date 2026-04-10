import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="page-shell">
      <section className="surface surface--primary panel panel--details">
        <span className="kicker">Game Details</span>
        <h1 className="title title--details">How Rig D Agent works</h1>
        <p className="subtitle">
          The homepage now stays focused on the pitch and first action. This page carries the mechanics, flow, and
          current room rules for players who want the full picture before they queue a room.
        </p>
        <div className="hero-actions">
          <Link className="ghost-button" href="/">
            Back to landing
          </Link>
        </div>
      </section>

      <section className="section-grid">
        <article className="surface surface--secondary panel panel--wide">
          <div className="section-heading">
            <h2 className="section-title">Match loop</h2>
          </div>
          <div className="details-flow">
            <div className="proof-card">
              <small>1. Room opens</small>
              <strong>Two players join a private match</strong>
              <p>Once both sides are present, they ready up and the arena assigns fighters.</p>
            </div>
            <div className="proof-card">
              <small>2. Corner setup</small>
              <strong>Roughly 18 seconds to set the lane</strong>
              <p>Players pick an opening style, pressure rule, and risk level before the bell.</p>
            </div>
            <div className="proof-card">
              <small>3. Fight goes live</small>
              <strong>Opening, rebuttal, closing with live corner calls</strong>
              <p>Both coaches spend corner energy on quick commands while momentum swings in public.</p>
            </div>
          </div>
        </article>

        <article className="surface surface--utility panel panel--side">
          <h2 className="section-title">MVP rules</h2>
          <ul className="list">
            <li>Only private 1v1 rooms.</li>
            <li>Only one mode: Debate Duel.</li>
            <li>Anonymous cookie-based sessions, no account wall.</li>
            <li>Live corner commands are public and bounded by an energy meter.</li>
            <li>Mock AI runs by default; server-side OpenAI activates with env config.</li>
          </ul>
        </article>
      </section>

      <section className="section-grid">
        <article className="surface surface--secondary panel panel--wide">
          <div className="section-heading">
            <h2 className="section-title">Scoring and payoff</h2>
          </div>
          <div className="proof-grid">
            <div className="proof-card">
              <small>Winner</small>
              <strong>The debate result still matters</strong>
              <p>The judge picks who argued more convincingly across the full exchange.</p>
            </div>
            <div className="proof-card">
              <small>Rig Score</small>
              <strong>Expectation is tracked separately</strong>
              <p>The best moment is when the weaker-looking side dramatically beats its baseline.</p>
            </div>
            <div className="proof-card">
              <small>Room feel</small>
              <strong>The game rewards timing, not command spam</strong>
              <p>Fast setup matters, but the live corner wins or loses the room.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
