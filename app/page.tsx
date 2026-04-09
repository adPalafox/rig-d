import Link from "next/link";
import { CreateRoomForm } from "@/components/CreateRoomForm";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-card">
          <span className="eyebrow">Rig D Agent</span>
          <h1 className="title">The smartest player isn&apos;t the AI. It&apos;s you.</h1>
          <p className="subtitle">
            Coach flawed stick-fighter agents through a live 1v1 debate duel. You do not win by drafting the best bot.
            You win by rigging the weakest one into an upset.
          </p>
          <div style={{ height: 20 }} />
          <div className="actions">
            <Link className="ghost-button" href="#how-it-works">
              See the loop
            </Link>
            <Link className="ghost-button" href="#agents">
              Meet the fighters
            </Link>
          </div>
        </div>
        <div className="cta-card">
          <div>
            <span className="pill">Private Beta MVP</span>
            <h2 style={{ margin: "14px 0 8px", fontFamily: "var(--display)", fontSize: "2rem" }}>
              Start a room
            </h2>
            <p className="muted">
              One topic. Two players. Three turns each. One reveal that shows who actually rigged their agent best.
            </p>
          </div>
          <CreateRoomForm />
        </div>
      </section>

      <section className="section-grid" id="how-it-works">
        <article className="panel panel--wide">
          <h2>Core Loop</h2>
          <ul className="list">
            <li>Two players enter a private room and ready up.</li>
            <li>Each player gets a different flawed agent with visible traits and hidden modifiers.</li>
            <li>Players get 60 seconds to coach using a structured prompt board.</li>
            <li>Agents debate in three turns: opening, rebuttal, closing.</li>
            <li>The system reveals both the winner and the player who outperformed expectation hardest.</li>
          </ul>
        </article>
        <article className="panel panel--side">
          <h2>Why It Lands</h2>
          <p>
            A strong model winning feels expected. A weak model winning feels stolen. The reveal tracks actual
            performance against expected performance so the underdog payoff is legible.
          </p>
        </article>
      </section>

      <section className="section-grid" id="agents">
        <article className="panel panel--wide">
          <h2>Agent Archetypes</h2>
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
        <article className="panel panel--side">
          <h2>MVP Rules</h2>
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
