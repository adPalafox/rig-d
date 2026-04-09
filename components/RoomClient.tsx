"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentStickman } from "@/components/AgentStickman";
import { MatchSnapshot } from "@/lib/types";
import { countdownRemaining } from "@/lib/utils";

type Props = {
  initialSnapshot: MatchSnapshot;
};

type CoachingDraft = {
  gamePlan: string;
  tone: string;
  whenAttacked: string;
  avoidThisMistake: string;
  secretNote: string;
};

const initialDraft: CoachingDraft = {
  gamePlan: "",
  tone: "",
  whenAttacked: "",
  avoidThisMistake: "",
  secretNote: "",
};

export function RoomClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    countdownRemaining(initialSnapshot.match.coachingDeadlineAt),
  );

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/matches/${initialSnapshot.match.id}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const json = (await response.json()) as MatchSnapshot;
      setSnapshot(json);
      setSecondsLeft(countdownRemaining(json.match.coachingDeadlineAt));
    }, 1200);
    return () => window.clearInterval(interval);
  }, [initialSnapshot.match.id]);

  useEffect(() => {
    setSecondsLeft(countdownRemaining(snapshot.match.coachingDeadlineAt));
    if (!snapshot.match.coachingDeadlineAt) return;
    const interval = window.setInterval(() => {
      setSecondsLeft(countdownRemaining(snapshot.match.coachingDeadlineAt));
    }, 250);
    return () => window.clearInterval(interval);
  }, [snapshot.match.coachingDeadlineAt]);

  const viewer = useMemo(
    () => snapshot.players.find((player) => player.id === snapshot.viewerPlayerId) ?? null,
    [snapshot],
  );
  const opponent = useMemo(
    () => snapshot.players.find((player) => player.id !== snapshot.viewerPlayerId) ?? null,
    [snapshot],
  );
  const canReady = snapshot.match.state === "waiting_for_players" || snapshot.match.state === "agent_assigned";
  const coachingOpen = snapshot.match.state === "coaching_open";
  const matchResolved = snapshot.match.state === "reveal_ready" || snapshot.match.state === "completed";

  async function runAction(path: string, body?: unknown) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await response.json()) as MatchSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Action failed.");
      }
      setSnapshot(json);
      return json;
    } catch (actionError) {
      setError((actionError as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="room-shell">
        <aside className="side-stack">
          <section className="panel">
            <span className="eyebrow">Private Room</span>
            <h1 className="title" style={{ fontSize: "2.4rem" }}>
              Room {snapshot.room.code}
            </h1>
            <p className="subtitle">Share this join link with your opponent and race to the reveal.</p>
            <div className="room-meta">
              <div className="meta-box">
                <small>Join Link</small>
                <strong className="inline-code">{snapshot.room.shareUrl}</strong>
              </div>
              <div className="meta-box">
                <small>Topic</small>
                <strong>{snapshot.match.topic.title}</strong>
              </div>
            </div>
            <div className="status-strip">
              <span className="status-chip">State: {snapshot.match.state.replaceAll("_", " ")}</span>
              {coachingOpen ? <span className="status-chip">Coaching: {secondsLeft}s</span> : null}
              {viewer ? <span className="status-chip">You: {viewer.name}</span> : null}
            </div>
            <div className="divider" />
            {canReady && viewer ? (
              <button
                className="button"
                onClick={() => void runAction(`/api/matches/${snapshot.match.id}/ready`)}
                disabled={loading || viewer.ready}
              >
                {viewer.ready ? "Ready locked" : "I am ready"}
              </button>
            ) : null}
            {matchResolved ? (
              <button
                className="ghost-button"
                onClick={() => void runAction(`/api/rooms/${snapshot.room.id}/rematch`)}
                disabled={loading}
              >
                Run it back
              </button>
            ) : null}
            {error ? <div className="error-box">{error}</div> : null}
            {message ? <div className="success-box">{message}</div> : null}
          </section>

          <section className="panel">
            <h2>Players</h2>
            <div className="agent-grid">
              {snapshot.players.map((player) => (
                <div className={`agent-card agent-card--${player.agent?.id ?? "Bruiser"}`} key={player.id}>
                  <AgentStickman color={player.agent?.bandanaColor ?? "#1e1b16"} />
                  <div className="pill">{player.name}</div>
                  <p className="muted">
                    {player.agent ? player.agent.flavor : "Waiting for the draft drum to assign an agent."}
                  </p>
                  {player.agent ? (
                    <ul className="list">
                      {player.agent.visibleTraits.map((trait) => (
                        <li key={trait}>{trait}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main style={{ display: "grid", gap: 24 }}>
          <section className="arena-card">
            <span className="eyebrow">Debate Duel</span>
            <h2>{snapshot.match.topic.title}</h2>
            <p>{snapshot.match.topic.prompt}</p>
            {snapshot.match.state === "waiting_for_players" ? (
              <p className="muted">You need two players, then both need to ready up before the coaching clock starts.</p>
            ) : null}
            {coachingOpen && viewer ? (
              <div style={{ marginTop: 16 }}>
                <div className="pill">Coaching clock: {secondsLeft}s</div>
                <div style={{ height: 12 }} />
                {viewer.submittedCoaching ? (
                  <div className="success-box">Your coaching is locked. Watching the other side now.</div>
                ) : (
                  <div className="form">
                    <div className="form-field">
                      <label htmlFor="gamePlan">Game Plan</label>
                      <textarea
                        id="gamePlan"
                        value={draft.gamePlan}
                        onChange={(event) => setDraft((prev) => ({ ...prev, gamePlan: event.target.value }))}
                        placeholder="One clean thesis, one concrete example, keep the opening short."
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="tone">Tone</label>
                      <input
                        id="tone"
                        value={draft.tone}
                        onChange={(event) => setDraft((prev) => ({ ...prev, tone: event.target.value }))}
                        placeholder="Calm, surgical, no grandstanding."
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="whenAttacked">When Attacked</label>
                      <textarea
                        id="whenAttacked"
                        value={draft.whenAttacked}
                        onChange={(event) => setDraft((prev) => ({ ...prev, whenAttacked: event.target.value }))}
                        placeholder="Call out missing evidence, then return to the core example."
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="avoid">Avoid This Mistake</label>
                      <textarea
                        id="avoid"
                        value={draft.avoidThisMistake}
                        onChange={(event) => setDraft((prev) => ({ ...prev, avoidThisMistake: event.target.value }))}
                        placeholder="Do not ramble. Do not exaggerate. Stay on one lane."
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="secret">Secret Note</label>
                      <textarea
                        id="secret"
                        value={draft.secretNote}
                        onChange={(event) => setDraft((prev) => ({ ...prev, secretNote: event.target.value }))}
                        placeholder="Optional hidden spice."
                      />
                    </div>
                    <div className="button-row">
                      <button
                        className="button"
                        onClick={async () => {
                          const result = await runAction(`/api/matches/${snapshot.match.id}/coaching`, draft);
                          if (result) setMessage("Coaching locked in.");
                        }}
                        disabled={loading}
                      >
                        Lock coaching
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {["coaching_locked", "executing_match", "judging"].includes(snapshot.match.state) ? (
              <div className="success-box" style={{ marginTop: 16 }}>
                The arena is resolving. Polling live for turns and scorecards.
              </div>
            ) : null}
            {snapshot.match.state === "abandoned" ? (
              <div className="error-box" style={{ marginTop: 16 }}>
                Match abandoned because a player dropped during coaching.
              </div>
            ) : null}
          </section>

          <section className="timeline-card">
            <h2>Live Match Feed</h2>
            <div className="timeline">
              {snapshot.turnLog.length === 0 ? (
                <p className="muted">No turns yet. The room is still setting up or resolving the first exchange.</p>
              ) : (
                snapshot.turnLog.map((turn) => {
                  const player = snapshot.players.find((entry) => entry.id === turn.playerId);
                  return (
                    <article className="turn-card" key={turn.id}>
                      <h4>
                        {player?.name} · {turn.agentId} · {turn.phase}
                      </h4>
                      <p>{turn.content}</p>
                      <p className="muted" style={{ marginTop: 10 }}>
                        Micro score: {turn.microScore}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          {snapshot.judgeResult ? (
            <section className="score-card">
              <span className="eyebrow">Reveal</span>
              <h2>
                Winner: {snapshot.players.find((player) => player.id === snapshot.judgeResult?.winnerPlayerId)?.name}
              </h2>
              <p>{snapshot.judgeResult.reasonSummary}</p>
              <div className="score-grid">
                {snapshot.players.map((player) => (
                  <div className="score-box" key={player.id}>
                    <small>{player.name}</small>
                    <strong>{player.agent?.name}</strong>
                    <div className="divider" />
                    <p>Expected: {player.expectedScore ?? "?"}</p>
                    <p>Actual: {player.actualScore ?? "?"}</p>
                    <p
                      className={`score-value ${(player.rigScore ?? 0) >= 0 ? "score-value--positive" : "score-value--negative"}`}
                    >
                      {player.rigScore !== null ? `${player.rigScore > 0 ? "+" : ""}${player.rigScore}` : "?"}
                    </p>
                    <p>{player.rigLabel ?? "Unscored"}</p>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="event-grid">
                {snapshot.players.map((player) => {
                  const categories = snapshot.judgeResult?.scoresByCategory[player.id];
                  return (
                    <div className="event-card" key={player.id}>
                      <h4>{player.name} rubric</h4>
                      <p>Clarity: {categories?.clarity ?? "-"}</p>
                      <p>Relevance: {categories?.relevance ?? "-"}</p>
                      <p>Rebuttal: {categories?.rebuttal ?? "-"}</p>
                      <p>Evidence: {categories?.evidence ?? "-"}</p>
                      <p>Consistency: {categories?.consistency ?? "-"}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <h3>Room Event Log</h3>
            <div className="timeline">
              {snapshot.events.map((eventItem) => (
                <article className="event-card" key={eventItem.id}>
                  <h4>{eventItem.type.replaceAll("_", " ")}</h4>
                  <p>{eventItem.message}</p>
                </article>
              ))}
            </div>
            {opponent ? (
              <p className="muted" style={{ marginTop: 16 }}>
                Opponent status: {opponent.name} {opponent.ready ? "is ready" : "is not ready yet"}.
              </p>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
