import Link from "next/link";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { HomeJoinForm } from "@/components/HomeJoinForm";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="surface surface--primary hero-card">
          <span className="eyebrow">Rig D Agent</span>
          <h1 className="title">Rig the underdog. Steal the room.</h1>
          <p className="subtitle">
            Coach a flawed AI stick-fighter through a fast private debate duel. The fun is not drafting the best bot.
            The fun is forcing a weaker one to outperform expectation.
          </p>
          <div className="hero-actions">
            <Link className="ghost-button" href="#how-it-works">
              See the loop
            </Link>
            <Link className="ghost-button" href="#archetypes">
              Meet the fighters
            </Link>
          </div>
          <div className="hero-points">
            <div className="summary-box">
              <small>Format</small>
              <strong>Private 1v1 rooms</strong>
              <p>One opponent, one topic, one reveal.</p>
            </div>
            <div className="summary-box">
              <small>Pressure</small>
              <strong>60-second coaching</strong>
              <p>You only get one short window to shape the agent.</p>
            </div>
            <div className="summary-box">
              <small>Payoff</small>
              <strong>Rig Score reveal</strong>
              <p>The winner and the best overperformance are both visible.</p>
            </div>
          </div>
        </div>
        <div className="cta-stack">
          <div className="surface surface--secondary cta-card">
            <div className="cta-copy">
              <span className="pill">Start Fast</span>
              <h2 className="section-title">Create a private room</h2>
              <p className="muted">Start the arena, claim your side, and send one invite link.</p>
            </div>
            <CreateRoomForm />
          </div>
          <div className="surface surface--utility cta-card">
            <div className="cta-copy">
              <span className="pill">Have A Code?</span>
              <h2 className="section-title">Join an existing room</h2>
              <p className="muted">Enter the invite code and step straight into the matchup.</p>
            </div>
            <HomeJoinForm />
          </div>
        </div>
      </section>

      <section className="section-grid" id="how-it-works">
        <article className="surface surface--secondary panel panel--wide">
          <h2 className="section-title">Core Loop</h2>
          <ul className="list">
            <li>Two players enter a private room and ready up.</li>
            <li>Each player gets a different flawed agent with visible traits and hidden modifiers.</li>
            <li>Players get 60 seconds to coach using a structured prompt board.</li>
            <li>Agents debate in three turns: opening, rebuttal, closing.</li>
            <li>The system reveals both the winner and the player who outperformed expectation hardest.</li>
          </ul>
        </article>
        <article className="surface surface--utility panel panel--side">
          <h2 className="section-title">Why It Lands</h2>
          <p>
            A strong model winning feels expected. A weak model winning feels stolen. The reveal tracks actual
            performance against expected performance so the underdog payoff is legible.
          </p>
        </article>
      </section>

      <section className="section-grid" id="archetypes">
        <article className="surface surface--secondary panel panel--wide">
          <h2 className="section-title">Agent Archetypes</h2>
          <div className="agent-grid">
            <div className="agent-card agent-card--Bruiser">
              <h3>Bruiser</h3>
              <p>High baseline. Low imagination. Thrives on a simple, brutal plan.</p>
            </div>
            <div className="agent-card agent-card--Gremlin">
              <h3>Gremlin</h3>
              <p>Low baseline. High volatility. Perfect for the dreamers trying to steal a win.</p>
            </div>
            <div className="agent-card agent-card--Scholar">
              <h3>Scholar</h3>
              <p>Measured and factual. Wants precision, not swagger.</p>
            </div>
            <div className="agent-card agent-card--Showman">
              <h3>Showman</h3>
              <p>Memorable and dangerous. Can soar or implode depending on the coaching.</p>
            </div>
          </div>
        </article>
        <article className="surface surface--utility panel panel--side">
          <h2 className="section-title">MVP Rules</h2>
          <ul className="list">
            <li>Only private 1v1 rooms.</li>
            <li>Only one mode: Debate Duel.</li>
            <li>Anonymous cookie-based sessions, no account wall.</li>
            <li>Mock AI runs by default; server-side OpenAI activates with env config.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
