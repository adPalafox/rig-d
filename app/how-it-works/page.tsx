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
              <p>Players set how the fighter enters, handles pressure, and how reckless the room is allowed to get.</p>
            </div>
            <div className="proof-card">
              <small>3. Fight goes live</small>
              <strong>The ring moves every time the corner speaks</strong>
              <p>Both coaches spend corner energy on fight calls that immediately change stance, space, and crowd heat.</p>
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
            <li>The arena board is the primary source of truth; transcripts are secondary.</li>
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
              <strong>The room cares about who controlled the chaos</strong>
              <p>The winner is the side that owned space, survived the mess, and made the better big moments land.</p>
            </div>
            <div className="proof-card">
              <small>Rig Score</small>
              <strong>Expectation is tracked separately</strong>
              <p>The best feeling is still dragging a shaky fighter way above expectation.</p>
            </div>
            <div className="proof-card">
              <small>Room feel</small>
              <strong>The game rewards timing, not command spam</strong>
              <p>Fast setup matters, but the visible ring action is the actual game now.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
