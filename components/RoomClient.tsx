"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentStickman } from "@/components/AgentStickman";
import { MatchSnapshot, MatchState } from "@/lib/types";
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

type StageKey = "lobby" | "coaching" | "resolving" | "reveal" | "abandoned";

const initialDraft: CoachingDraft = {
  gamePlan: "",
  tone: "",
  whenAttacked: "",
  avoidThisMistake: "",
  secretNote: "",
};

const resolvingStates: MatchState[] = ["coaching_locked", "executing_match", "judging"];
const revealStates: MatchState[] = ["reveal_ready", "completed"];

function formatStateLabel(state: string) {
  return state.replaceAll("_", " ");
}

function getStageKey(state: MatchState): StageKey {
  if (state === "abandoned") return "abandoned";
  if (state === "coaching_open") return "coaching";
  if (resolvingStates.includes(state)) return "resolving";
  if (revealStates.includes(state)) return "reveal";
  return "lobby";
}

function getStageOrder(stage: StageKey) {
  if (stage === "abandoned") return -1;
  if (stage === "lobby") return 0;
  if (stage === "coaching") return 1;
  if (stage === "resolving") return 2;
  return 3;
}

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
    setDraft(initialDraft);
    setError("");
    setMessage("");
  }, [snapshot.match.id]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/matches/${snapshot.match.id}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const json = (await response.json()) as MatchSnapshot;
      setSnapshot(json);
      setSecondsLeft(countdownRemaining(json.match.coachingDeadlineAt));
    }, 1200);

    return () => window.clearInterval(interval);
  }, [snapshot.match.id]);

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

  const stageKey = getStageKey(snapshot.match.state);
  const canReady = stageKey === "lobby" && viewer !== null;
  const coachingOpen = stageKey === "coaching";
  const resolving = stageKey === "resolving";
  const matchResolved = stageKey === "reveal";
  const showTurnFeed = resolving || matchResolved;
  const showEventLog = resolving || matchResolved || stageKey === "abandoned";
  const turnProgress = Math.min(snapshot.turnLog.length, 6);
  const winner = snapshot.players.find((player) => player.id === snapshot.judgeResult?.winnerPlayerId) ?? null;
  const viewerAgent = viewer?.agent ?? null;
  const opponentAgent = opponent?.agent ?? null;
  const viewerColor = viewerAgent?.bandanaColor ?? "#1e1b16";
  const opponentColor = opponentAgent?.bandanaColor ?? "#5e574d";

  const phaseCopy = {
    lobby: {
      label: "Lobby",
      title: opponent ? "Get both coaches locked in" : "Waiting for the second player",
      description: opponent
        ? "Both players need to ready up before the arena assigns agents and opens coaching."
        : "Share the room link, get your opponent in, then lock in when both sides are present.",
    },
    coaching: {
      label: "Coaching",
      title: viewer?.submittedCoaching ? "Your coaching is locked" : "Coach your fighter for the upset",
      description: viewer?.submittedCoaching
        ? "Your side is set. The room will move once the other coach locks in or the timer expires."
        : "Give one clean plan, one pressure response, and one mistake to avoid. The best coaching is sharp, not crowded.",
    },
    resolving: {
      label: "Arena Resolving",
      title: "The match is unfolding",
      description:
        "The system is running opening, rebuttal, and closing turns, then judging the full exchange.",
    },
    reveal: {
      label: "Reveal",
      title: winner ? `${winner.name} won the room` : "The result is in",
      description: snapshot.judgeResult?.reasonSummary ?? "The final score is ready for both sides.",
    },
    abandoned: {
      label: "Match Interrupted",
      title: "The room was abandoned during coaching",
      description: "One player dropped for too long, so this round did not resolve.",
    },
  }[stageKey];

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

  async function copyShareLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(snapshot.room.shareUrl);
      setMessage("Join link copied.");
    } catch {
      setError("Could not copy the join link.");
    }
  }

  return (
    <div className="page-shell page-shell--room">
      {stageKey === "lobby" ? (
        <section className="surface surface--secondary room-summary">
          <div className="room-summary__header">
            <div>
              <span className="kicker">Private Room</span>
              <h1 className="room-title">Room {snapshot.room.code}</h1>
              <p className="summary-copy">{snapshot.match.topic.prompt}</p>
            </div>
            <div className="status-strip">
              <span className="status-badge">Phase: {phaseCopy.label}</span>
              <span className="status-badge">
                Matchup: {viewer?.name ?? "You"} vs {opponent?.name ?? "Waiting for opponent"}
              </span>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-box summary-box--wide">
              <small>Share link</small>
              <strong className="inline-code room-link">{snapshot.room.shareUrl}</strong>
              <div className="summary-actions">
                <button className="ghost-button button--small" type="button" onClick={() => void copyShareLink()}>
                  Copy link
                </button>
              </div>
            </div>
            <div className="summary-box">
              <small>Topic</small>
              <strong>{snapshot.match.topic.title}</strong>
              <p>{snapshot.match.topic.tags.join(" · ")}</p>
            </div>
            <div className="summary-box">
              <small>You</small>
              <strong>{viewer?.name ?? "Observer"}</strong>
              <p>{viewer?.ready ? "Ready locked." : "Not ready yet."}</p>
            </div>
            <div className="summary-box">
              <small>Opponent</small>
              <strong>{opponent?.name ?? "Open slot"}</strong>
              <p>{opponent ? (opponent.ready ? "Ready locked." : "Not ready yet.") : "Waiting to join."}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="room-shell">
        <main className="stage-stack">
          <section className="surface surface--primary stage-panel">
            <div className="stage-panel__header">
              <div>
                <span className="kicker">{phaseCopy.label}</span>
                <h2 className="stage-title">{phaseCopy.title}</h2>
                <p className="subtitle">{phaseCopy.description}</p>
              </div>
              {coachingOpen ? (
                <div className="countdown-card">
                  <small>Coaching clock</small>
                  <strong>{secondsLeft}s</strong>
                </div>
              ) : null}
            </div>

            <div className="phase-track" aria-label="Match progress">
              {[
                { key: "lobby" as StageKey, label: "Lobby" },
                { key: "coaching" as StageKey, label: "Coaching" },
                { key: "resolving" as StageKey, label: "Arena" },
                { key: "reveal" as StageKey, label: "Reveal" },
              ].map((step) => {
                const stepState =
                  stageKey === "abandoned"
                    ? "pending"
                    : getStageOrder(step.key) < getStageOrder(stageKey)
                      ? "done"
                      : step.key === stageKey
                        ? "active"
                        : "pending";

                return (
                  <div className={`phase-step phase-step--${stepState}`} key={step.key}>
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>

            {error ? <div className="error-box">{error}</div> : null}
            {message ? <div className="success-box">{message}</div> : null}

            {stageKey === "lobby" ? (
              <div className="stage-content">
                <div className="stage-subpanel">
                  <h3 className="section-title">What happens next</h3>
                  <ul className="list">
                    <li>Two players need to be in the room.</li>
                    <li>Both players must ready up.</li>
                    <li>Agents are assigned and the 60-second coaching phase begins.</li>
                  </ul>
                </div>
                <div className="action-card">
                  <h3 className="section-title">Ready checkpoint</h3>
                  <p className="muted">
                    {opponent
                      ? "Once both sides are ready, the room rolls forward immediately."
                      : "Share the link first if your opponent is not here yet."}
                  </p>
                  {canReady ? (
                    <button
                      className="button button--full"
                      type="button"
                      onClick={() => void runAction(`/api/matches/${snapshot.match.id}/ready`)}
                      disabled={loading || viewer?.ready}
                    >
                      {viewer?.ready ? "Ready locked" : "I am ready"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {stageKey === "coaching" && viewer ? (
              <div className="coach-workspace">
                <div className="coach-agent-card">
                  <div className={`agent-card agent-card--${viewer.agent?.id ?? "Bruiser"} agent-card--spotlight`}>
                    <div className="agent-stage">
                      <AgentStickman
                        className="agent-stickman agent-stickman--hero"
                        color={viewer.agent?.bandanaColor ?? "#1e1b16"}
                        variant={viewer.agent?.id ?? "Bruiser"}
                        pose={viewer.submittedCoaching ? "victory" : "duel"}
                        emphasis="spotlight"
                      />
                    </div>
                    <div className="agent-card__header">
                      <div>
                        <small>Your fighter</small>
                        <h3>{viewer.agent?.name ?? "Agent incoming"}</h3>
                      </div>
                      <span className="meta-pill">{viewer.name}</span>
                    </div>
                    <p className="muted">
                      {viewer.agent?.flavor ?? "Your agent will appear as soon as both sides are ready."}
                    </p>
                    {viewer.agent ? (
                      <ul className="list">
                        {viewer.agent.visibleTraits.map((trait) => (
                          <li key={trait}>{trait}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                <div className="coach-form-shell">
                  {viewer.submittedCoaching ? (
                    <div className="success-box">
                      Your coaching is locked. The room is now waiting on the other side or the timer to expire.
                    </div>
                  ) : (
                    <div className="form">
                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Strategy</h3>
                          <p className="muted">Set the thesis and delivery style the agent should hold onto.</p>
                        </div>
                        <div className="form-field">
                          <label htmlFor="gamePlan">Game plan</label>
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
                      </div>

                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Pressure response</h3>
                          <p className="muted">Tell the agent how to answer attacks and what failure mode to avoid.</p>
                        </div>
                        <div className="form-field">
                          <label htmlFor="whenAttacked">When attacked</label>
                          <textarea
                            id="whenAttacked"
                            value={draft.whenAttacked}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, whenAttacked: event.target.value }))
                            }
                            placeholder="Call out missing evidence, then return to the core example."
                          />
                        </div>
                        <div className="form-field">
                          <label htmlFor="avoid">Avoid this mistake</label>
                          <textarea
                            id="avoid"
                            value={draft.avoidThisMistake}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, avoidThisMistake: event.target.value }))
                            }
                            placeholder="Do not ramble. Do not exaggerate. Stay on one lane."
                          />
                        </div>
                      </div>

                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Optional secret note</h3>
                          <p className="muted">Add a little hidden edge if you have one.</p>
                        </div>
                        <div className="form-field">
                          <label htmlFor="secret">Secret note</label>
                          <textarea
                            id="secret"
                            value={draft.secretNote}
                            onChange={(event) => setDraft((prev) => ({ ...prev, secretNote: event.target.value }))}
                            placeholder="Optional hidden spice."
                          />
                        </div>
                      </div>

                      <div className="button-row">
                        <button
                          className="button"
                          type="button"
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
              </div>
            ) : null}

            {stageKey === "resolving" ? (
              <div className="stage-content">
                <div className="stage-subpanel">
                  <h3 className="section-title">Arena progress</h3>
                  <div className="versus-scene versus-scene--compact">
                    <AgentStickman
                      className="agent-stickman agent-stickman--duel"
                      color={viewerColor}
                      variant={viewerAgent?.id ?? "Bruiser"}
                      pose="duel"
                      emphasis="ring"
                    />
                    <div className="versus-scene__badge">vs</div>
                    <AgentStickman
                      className="agent-stickman agent-stickman--duel"
                      color={opponentColor}
                      variant={opponentAgent?.id ?? "Showman"}
                      pose="duel"
                      emphasis="ring"
                      flipped
                    />
                  </div>
                  <div className="metric-row">
                    <div className="metric-box">
                      <small>Turns resolved</small>
                      <strong>
                        {turnProgress} / 6
                      </strong>
                    </div>
                    <div className="metric-box">
                      <small>Judge status</small>
                      <strong>{snapshot.match.state === "judging" ? "Scoring now" : "Waiting on full exchange"}</strong>
                    </div>
                  </div>
                </div>
                <div className="action-card">
                  <h3 className="section-title">What to watch</h3>
                  <p className="muted">
                    The live feed below is the narrative view. The room event log is still available, but it is no
                    longer the main thing to track.
                  </p>
                </div>
              </div>
            ) : null}

            {stageKey === "reveal" && snapshot.judgeResult ? (
              <div className="reveal-stack">
                <div className="reveal-banner">
                  <div className="reveal-banner__scene">
                    <AgentStickman
                      className="agent-stickman agent-stickman--reveal"
                      color={
                        snapshot.players.find((player) => player.id === winner?.id)?.agent?.bandanaColor ?? viewerColor
                      }
                      variant={winner?.agent?.id ?? viewerAgent?.id ?? "Bruiser"}
                      pose="victory"
                      emphasis="burst"
                    />
                    <AgentStickman
                      className="agent-stickman agent-stickman--reveal agent-stickman--loser"
                      color={
                        snapshot.players.find((player) => player.id !== winner?.id)?.agent?.bandanaColor ?? opponentColor
                      }
                      variant={snapshot.players.find((player) => player.id !== winner?.id)?.agent?.id ?? opponentAgent?.id ?? "Gremlin"}
                      pose="slump"
                      emphasis="ring"
                      flipped
                    />
                  </div>
                  <div>
                    <small>Winner</small>
                    <h3>{winner?.name ?? "Unknown"}</h3>
                    <p className="muted">{snapshot.judgeResult.reasonSummary}</p>
                  </div>
                  <div className="confidence-pill">
                    <small>Judge confidence</small>
                    <strong>{Math.round(snapshot.judgeResult.confidence * 100)}%</strong>
                  </div>
                </div>

                <div className="score-grid">
                  {snapshot.players.map((player) => (
                    <div className="score-box" key={player.id}>
                      <small>{player.name}</small>
                      <strong>{player.agent?.name ?? "Unassigned"}</strong>
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

                <div className="button-row">
                  <button
                    className="button"
                    type="button"
                    onClick={() => void runAction(`/api/rooms/${snapshot.room.id}/rematch`)}
                    disabled={loading}
                  >
                    Run it back
                  </button>
                </div>
              </div>
            ) : null}

            {stageKey === "abandoned" ? (
              <div className="stage-content">
                <div className="stage-subpanel">
                  <h3 className="section-title">Recovery</h3>
                  <p className="muted">The round stopped because a player disconnected for too long during coaching.</p>
                </div>
                <div className="action-card">
                  <h3 className="section-title">Next move</h3>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => void runAction(`/api/rooms/${snapshot.room.id}/rematch`)}
                    disabled={loading}
                  >
                    Start a fresh round
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {showTurnFeed ? (
            <section className="surface surface--utility utility-panel">
              <div className="utility-header">
                <h3 className="section-title">Live match feed</h3>
                <p className="muted">Round-by-round output from the two agents.</p>
              </div>
              <div className="timeline">
                {snapshot.turnLog.length === 0 ? (
                  <p className="muted">No turns yet. The arena is still getting ready.</p>
                ) : (
                  snapshot.turnLog.map((turn) => {
                    const player = snapshot.players.find((entry) => entry.id === turn.playerId);
                    return (
                      <article className="turn-card" key={turn.id}>
                        <h4>
                          {player?.name} · {turn.agentId} · {turn.phase}
                        </h4>
                        <p>{turn.content}</p>
                        <p className="turn-score">Micro score: {turn.microScore}</p>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {matchResolved && snapshot.judgeResult ? (
            <section className="surface surface--utility utility-panel">
              <details className="detail-disclosure">
                <summary>Rubric breakdown</summary>
                <div className="detail-grid">
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
              </details>
            </section>
          ) : null}

          {showEventLog ? (
            <section className="surface surface--utility utility-panel">
              <details className="detail-disclosure">
                <summary>Room event log</summary>
                <div className="timeline">
                  {snapshot.events.map((eventItem) => (
                    <article className="event-card" key={eventItem.id}>
                      <h4>{formatStateLabel(eventItem.type)}</h4>
                      <p>{eventItem.message}</p>
                    </article>
                  ))}
                </div>
              </details>
            </section>
          ) : null}
        </main>

        <aside className="side-stack">
          <section className="surface surface--secondary roster-panel">
            <div className="utility-header utility-header--stacked">
              <h3 className="section-title">Coaches</h3>
              <p className="muted">
                {stageKey === "coaching"
                  ? "Visible traits are on display. Hidden modifiers still have to be discovered through coaching."
                  : "This roster changes emphasis as the room moves from setup to reveal."}
              </p>
            </div>
            <div className="roster-list">
              {snapshot.players.map((player) => (
                <div
                  className={`agent-card roster-card agent-card--${player.agent?.id ?? "Bruiser"} ${
                    player.id === snapshot.viewerPlayerId ? "agent-card--viewer" : ""
                  }`}
                  key={player.id}
                >
                    <div className="roster-card__identity">
                      <small>{player.id === snapshot.viewerPlayerId ? "You" : "Opponent"}</small>
                      <h3>{player.name}</h3>
                    <p className="roster-card__state">
                      {stageKey === "reveal"
                        ? `${player.rigLabel ?? "Unscored"} · Rig score ${
                            player.rigScore !== null ? `${player.rigScore > 0 ? "+" : ""}${player.rigScore}` : "?"
                          }`
                        : player.agent
                          ? `Agent: ${player.agent.name}`
                          : "Agent pending"}
                    </p>
                  </div>
                  <p className="muted roster-card__summary">
                    {stageKey === "reveal"
                      ? `${player.rigLabel ?? "Unscored"} · Expected ${player.expectedScore ?? "?"} · Actual ${
                          player.actualScore ?? "?"
                        }`
                      : player.agent?.flavor ?? "Agent assignment unlocks when both players are ready."}
                  </p>
                  <div className="status-strip roster-card__chips">
                    <span className="status-badge">{player.ready ? "Ready" : "Not ready"}</span>
                    {coachingOpen || resolving || matchResolved ? (
                      <span className="status-badge">
                        {player.submittedCoaching ? "Coaching locked" : "Coaching open"}
                      </span>
                    ) : null}
                    {player.disconnected ? <span className="status-badge status-badge--warning">Disconnected</span> : null}
                  </div>
                  {player.agent && stageKey !== "reveal" ? (
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
      </div>
    </div>
  );
}
