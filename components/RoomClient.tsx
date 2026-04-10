"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentStickman } from "@/components/AgentStickman";
import {
  LIVE_COMMAND_DEFINITIONS,
  OPENING_STYLE_OPTIONS,
  PRESSURE_RULE_OPTIONS,
  RISK_LEVEL_OPTIONS,
} from "@/lib/content";
import { DebatePhase, MatchSnapshot, MatchState, SetupPlan } from "@/lib/types";
import { countdownRemaining } from "@/lib/utils";

type Props = {
  initialSnapshot: MatchSnapshot;
};

type StageKey = "lobby" | "setup" | "live" | "reveal" | "abandoned";

const initialSetupDraft: SetupPlan = {
  openingStyle: OPENING_STYLE_OPTIONS[0]!.id,
  pressureRule: PRESSURE_RULE_OPTIONS[0]!.id,
  riskLevel: RISK_LEVEL_OPTIONS[1]!.id,
  signatureLine: "",
};

const revealStates: MatchState[] = ["reveal_ready", "completed"];

function formatStateLabel(state: string) {
  return state.replaceAll("_", " ");
}

function formatPhaseLabel(phase: DebatePhase | null) {
  if (!phase) return "Fight";
  return `${phase[0]!.toUpperCase()}${phase.slice(1)}`;
}

function getStageKey(state: MatchState): StageKey {
  if (state === "abandoned") return "abandoned";
  if (state === "setup_open") return "setup";
  if (state === "live_phase_open" || state === "judging") return "live";
  if (revealStates.includes(state)) return "reveal";
  return "lobby";
}

function getStageOrder(stage: StageKey) {
  if (stage === "abandoned") return -1;
  if (stage === "lobby") return 0;
  if (stage === "setup") return 1;
  if (stage === "live") return 2;
  return 3;
}

function scoreMomentum(left: number, right: number) {
  const diff = clampMomentum(left - right);
  return {
    left: clampPercentage(50 + diff * 2),
    right: clampPercentage(50 - diff * 2),
  };
}

function clampMomentum(value: number) {
  return Math.max(-20, Math.min(20, value));
}

function clampPercentage(value: number) {
  return Math.max(10, Math.min(90, value));
}

export function RoomClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [setupDraft, setSetupDraft] = useState(initialSetupDraft);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    countdownRemaining(initialSnapshot.match.setupDeadlineAt ?? initialSnapshot.match.phaseDeadlineAt),
  );

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    setSetupDraft(initialSetupDraft);
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
      setSecondsLeft(
        countdownRemaining(json.match.setupDeadlineAt ?? json.match.phaseDeadlineAt),
      );
    }, 900);

    return () => window.clearInterval(interval);
  }, [snapshot.match.id]);

  useEffect(() => {
    const deadline = snapshot.match.setupDeadlineAt ?? snapshot.match.phaseDeadlineAt;
    setSecondsLeft(countdownRemaining(deadline));
    if (!deadline) return;

    const interval = window.setInterval(() => {
      setSecondsLeft(countdownRemaining(deadline));
    }, 250);

    return () => window.clearInterval(interval);
  }, [snapshot.match.setupDeadlineAt, snapshot.match.phaseDeadlineAt]);

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
  const setupOpen = stageKey === "setup";
  const liveOpen = snapshot.match.state === "live_phase_open";
  const fightStage = stageKey === "live";
  const matchResolved = stageKey === "reveal";
  const viewerMomentum = viewer?.momentum ?? 0;
  const opponentMomentum = opponent?.momentum ?? 0;
  const momentumSplit = scoreMomentum(viewerMomentum, opponentMomentum);
  const winner =
    snapshot.players.find((player) => player.id === snapshot.judgeResult?.winnerPlayerId) ?? null;

  async function runPost(path: string, body?: unknown) {
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

  const phaseCopy = {
    lobby: {
      label: "Lobby",
      title: opponent ? "Get both coaches in the room" : "Waiting for the second coach",
      description: opponent
        ? "Both coaches ready up, then the corner gets a short setup window before the bell."
        : "Share the invite link, pull in your opponent, and get the room hot.",
    },
    setup: {
      label: "Setup",
      title: viewer?.submittedSetup ? "Your corner plan is locked" : "Set the corner plan fast",
      description: viewer?.submittedSetup
        ? "Your setup is in. Once the other side locks or the timer burns out, the fight opens."
        : "Pick an opening, a pressure rule, and how reckless you want to be. The live corner does the rest.",
    },
    live: {
      label: snapshot.match.state === "judging" ? "Judging" : formatPhaseLabel(snapshot.match.currentPhase),
      title:
        snapshot.match.state === "judging"
          ? "Scoring the chaos"
          : `${formatPhaseLabel(snapshot.match.currentPhase)} bell is live`,
      description:
        snapshot.match.state === "judging"
          ? "The fight is over. The judge is deciding what mattered."
          : "Both corners can bark commands at any time. Spend energy well or burn your fighter out.",
    },
    reveal: {
      label: "Reveal",
      title: winner ? `${winner.name} won the room` : "The room has a winner",
      description:
        snapshot.judgeResult?.coachingImpactSummary ??
        "The final result is in and the corner impact is visible.",
    },
    abandoned: {
      label: "Interrupted",
      title: "The room broke before the fight landed",
      description: "One coach dropped for too long and the round was abandoned.",
    },
  }[stageKey];

  return (
    <div className="page-shell page-shell--room">
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
            <small>Series</small>
            <strong>{snapshot.room.rivalry.roundsPlayed} rounds</strong>
            <p>
              {snapshot.room.rivalry.currentStreakPlayerId
                ? `${snapshot.players.find((player) => player.id === snapshot.room.rivalry.currentStreakPlayerId)?.name ?? "Someone"} on ${snapshot.room.rivalry.currentStreakCount}`
                : "No streak yet."}
            </p>
          </div>
          <div className="summary-box">
            <small>Clock</small>
            <strong>{secondsLeft}s</strong>
            <p>
              {setupOpen
                ? "Short corner setup."
                : fightStage
                  ? `${formatPhaseLabel(snapshot.match.currentPhase)} window`
                  : "Waiting on action."}
            </p>
          </div>
        </div>
      </section>

      <div className="room-shell">
        <main className="stage-stack">
          <section className="surface surface--primary stage-panel">
            <div className="stage-panel__header">
              <div>
                <span className="kicker">{phaseCopy.label}</span>
                <h2 className="stage-title">{phaseCopy.title}</h2>
                <p className="subtitle">{phaseCopy.description}</p>
              </div>
              {(setupOpen || fightStage) && snapshot.match.state !== "judging" ? (
                <div className="countdown-card">
                  <small>{setupOpen ? "Setup clock" : "Bell clock"}</small>
                  <strong>{secondsLeft}s</strong>
                </div>
              ) : null}
            </div>

            <div className="phase-track" aria-label="Match progress">
              {[
                { key: "lobby" as StageKey, label: "Lobby" },
                { key: "setup" as StageKey, label: "Setup" },
                { key: "live" as StageKey, label: "Fight" },
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
                    <li>Two coaches join the room.</li>
                    <li>Both sides ready up.</li>
                    <li>The room gets a short setup window before the live corner starts.</li>
                  </ul>
                </div>
                <div className="action-card">
                  <h3 className="section-title">Ready checkpoint</h3>
                  <p className="muted">
                    {opponent
                      ? "Once both sides are ready, the fighter draw and corner setup happen immediately."
                      : "Share the room link first if your opponent is not here yet."}
                  </p>
                  {canReady ? (
                    <button
                      className="button button--full"
                      type="button"
                      onClick={() => void runPost(`/api/matches/${snapshot.match.id}/ready`)}
                      disabled={loading || viewer?.ready}
                    >
                      {viewer?.ready ? "Ready locked" : "I am ready"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {setupOpen && viewer ? (
              <div className="coach-workspace coach-workspace--setup">
                <div className="coach-agent-card">
                  <div className={`agent-card agent-card--${viewer.agent?.id ?? "Bruiser"} agent-card--spotlight`}>
                    <div className="agent-stage">
                      <AgentStickman
                        className="agent-stickman agent-stickman--hero"
                        color={viewer.agent?.bandanaColor ?? "#1e1b16"}
                        variant={viewer.agent?.id ?? "Bruiser"}
                        pose={viewer.submittedSetup ? "victory" : "duel"}
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
                      {viewer.agent?.flavor ?? "The fighter appears as soon as both sides are ready."}
                    </p>
                    {viewer.agent ? (
                      <>
                        <ul className="list">
                          {viewer.agent.visibleTraits.map((trait) => (
                            <li key={trait}>{trait}</li>
                          ))}
                        </ul>
                        <div className="coach-tip-grid">
                          <div className="proof-card">
                            <small>Hint</small>
                            <strong>{viewer.agent.publicHint}</strong>
                          </div>
                          <div className="proof-card proof-card--warning">
                            <small>Danger</small>
                            <strong>{viewer.agent.publicDanger}</strong>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="coach-form-shell">
                  {viewer.submittedSetup ? (
                    <div className="success-box">
                      Your setup is locked. The fight opens when the other corner locks or the timer runs out.
                    </div>
                  ) : (
                    <div className="form form--setup">
                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Opening style</h3>
                          <p className="muted">How should the fighter enter the room?</p>
                        </div>
                        <div className="choice-grid">
                          {OPENING_STYLE_OPTIONS.map((option) => (
                            <button
                              className={`choice-chip ${setupDraft.openingStyle === option.id ? "choice-chip--selected" : ""}`}
                              key={option.id}
                              type="button"
                              onClick={() => setSetupDraft((prev) => ({ ...prev, openingStyle: option.id }))}
                            >
                              <strong>{option.label}</strong>
                              <span>{option.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Pressure rule</h3>
                          <p className="muted">What should the corner keep yelling when things get ugly?</p>
                        </div>
                        <div className="choice-grid">
                          {PRESSURE_RULE_OPTIONS.map((option) => (
                            <button
                              className={`choice-chip ${setupDraft.pressureRule === option.id ? "choice-chip--selected" : ""}`}
                              key={option.id}
                              type="button"
                              onClick={() => setSetupDraft((prev) => ({ ...prev, pressureRule: option.id }))}
                            >
                              <strong>{option.label}</strong>
                              <span>{option.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Risk level</h3>
                          <p className="muted">How reckless should this corner be?</p>
                        </div>
                        <div className="choice-grid">
                          {RISK_LEVEL_OPTIONS.map((option) => (
                            <button
                              className={`choice-chip ${setupDraft.riskLevel === option.id ? "choice-chip--selected" : ""}`}
                              key={option.id}
                              type="button"
                              onClick={() => setSetupDraft((prev) => ({ ...prev, riskLevel: option.id }))}
                            >
                              <strong>{option.label}</strong>
                              <span>{option.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Signature line</h3>
                          <p className="muted">Optional. Give the fighter one sticky phrase to keep returning to.</p>
                        </div>
                        <div className="form-field">
                          <label htmlFor="signatureLine">Signature line</label>
                          <input
                            id="signatureLine"
                            value={setupDraft.signatureLine ?? ""}
                            maxLength={64}
                            onChange={(event) =>
                              setSetupDraft((prev) => ({ ...prev, signatureLine: event.target.value }))
                            }
                            placeholder="If they want the future, make them answer the street today."
                          />
                        </div>
                      </div>

                      <div className="button-row">
                        <button
                          className="button"
                          type="button"
                          onClick={async () => {
                            const result = await runPost(`/api/matches/${snapshot.match.id}/coaching`, setupDraft);
                            if (result) setMessage("Corner plan locked.");
                          }}
                          disabled={loading}
                        >
                          Lock corner plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {fightStage && viewer ? (
              <div className="live-corner-shell">
                <div className="momentum-panel">
                  <div className="momentum-panel__labels">
                    <span>{viewer.name}</span>
                    <strong>{snapshot.match.state === "judging" ? "Fight closed" : `${formatPhaseLabel(snapshot.match.currentPhase)} in play`}</strong>
                    <span>{opponent?.name ?? "Opponent"}</span>
                  </div>
                  <div className="momentum-bar">
                    <div className="momentum-bar__lane momentum-bar__lane--left" style={{ width: `${momentumSplit.left}%` }} />
                    <div className="momentum-bar__lane momentum-bar__lane--right" style={{ width: `${momentumSplit.right}%` }} />
                  </div>
                  <div className="momentum-panel__scores">
                    <span>{viewerMomentum > 0 ? `+${viewerMomentum}` : viewerMomentum}</span>
                    <span>{opponentMomentum > 0 ? `+${opponentMomentum}` : opponentMomentum}</span>
                  </div>
                </div>

                <div className="energy-grid">
                  {[viewer, opponent].filter(Boolean).map((player) => (
                    <div className="metric-box" key={player!.id}>
                      <small>{player!.id === viewer.id ? "Your corner" : "Opponent corner"}</small>
                      <strong>{player!.cornerEnergy}/5 energy</strong>
                      <p>
                        {player!.activeCommandFeed[0]
                          ? `Last bark: ${player!.activeCommandFeed[0]!.label}`
                          : "No command yet."}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="command-grid">
                  {LIVE_COMMAND_DEFINITIONS.map((command) => (
                    <button
                      className={`command-chip ${viewer.cornerEnergy < command.cost || !liveOpen ? "command-chip--disabled" : ""}`}
                      key={command.id}
                      type="button"
                      disabled={loading || !liveOpen || viewer.cornerEnergy < command.cost}
                      onClick={async () => {
                        const result = await runPost(`/api/matches/${snapshot.match.id}/command`, {
                          commandId: command.id,
                        });
                        if (result) setMessage(`${command.label} fired.`);
                      }}
                    >
                      <strong>{command.label}</strong>
                      <span>{command.description}</span>
                      <small>{command.cost} energy</small>
                    </button>
                  ))}
                </div>

                <div className="stage-content">
                  <div className="stage-subpanel">
                    <h3 className="section-title">What to do</h3>
                    <p className="muted">
                      Spam loses value. Time the right nudge when you are slipping or when the other side is wobbling.
                    </p>
                  </div>
                  <div className="action-card">
                    <h3 className="section-title">Current phase</h3>
                    <p className="muted">
                      {snapshot.match.state === "judging"
                        ? "The commands are closed and the judge is sorting the damage."
                        : `${formatPhaseLabel(snapshot.match.currentPhase)} is live for both corners.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {matchResolved && snapshot.judgeResult ? (
              <div className="reveal-stack">
                <div className="reveal-banner">
                  <div className="reveal-banner__sceneWrap">
                    <div className="reveal-banner__scene">
                      <AgentStickman
                        className="agent-stickman agent-stickman--reveal"
                        color={winner?.agent?.bandanaColor ?? "#1e1b16"}
                        variant={winner?.agent?.id ?? "Bruiser"}
                        pose="victory"
                        emphasis="burst"
                      />
                      <AgentStickman
                        className="agent-stickman agent-stickman--reveal agent-stickman--loser"
                        color={snapshot.players.find((player) => player.id !== winner?.id)?.agent?.bandanaColor ?? "#5e574d"}
                        variant={snapshot.players.find((player) => player.id !== winner?.id)?.agent?.id ?? "Gremlin"}
                        pose="slump"
                        emphasis="ring"
                        flipped
                      />
                    </div>
                  </div>
                  <div className="reveal-banner__summary">
                    <div className="confidence-pill">
                      <small>Judge confidence</small>
                      <strong>{Math.round(snapshot.judgeResult.confidence * 100)}%</strong>
                    </div>
                    <small>Winner</small>
                    <h3>{winner?.name ?? "Unknown"}</h3>
                    <p className="muted">{snapshot.judgeResult.reasonSummary}</p>
                    <p className="muted reveal-impact-copy">{snapshot.judgeResult.coachingImpactSummary}</p>
                  </div>
                </div>

                {snapshot.judgeResult.decisiveMoment ? (
                  <div className="proof-card proof-card--decisive">
                    <small>Decisive moment</small>
                    <strong>{snapshot.judgeResult.decisiveMoment.summary}</strong>
                    <p>
                      {snapshot.judgeResult.decisiveMoment.playerName} swung the {snapshot.judgeResult.decisiveMoment.phase} with{" "}
                      {snapshot.judgeResult.decisiveMoment.commands
                        .map((commandId) => LIVE_COMMAND_DEFINITIONS.find((command) => command.id === commandId)?.label ?? commandId)
                        .join(" + ")}
                      .
                    </p>
                  </div>
                ) : null}

                <div className="score-grid">
                  {snapshot.players.map((player) => (
                    <div className="score-box" key={player.id}>
                      <small>{player.name}</small>
                      <strong>{player.agent?.name ?? "Unassigned"}</strong>
                      <div className="divider" />
                      <p>Expected: {player.expectedScore ?? "?"}</p>
                      <p>Actual: {player.actualScore ?? "?"}</p>
                      <p className={`score-value ${(player.rigScore ?? 0) >= 0 ? "score-value--positive" : "score-value--negative"}`}>
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
                    onClick={() => void runPost(`/api/rooms/${snapshot.room.id}/rematch`)}
                    disabled={loading}
                  >
                    New topic, same grudge
                  </button>
                </div>
              </div>
            ) : null}

            {stageKey === "abandoned" ? (
              <div className="stage-content">
                <div className="stage-subpanel">
                  <h3 className="section-title">Recovery</h3>
                  <p className="muted">The round stopped because a coach disconnected for too long.</p>
                </div>
                <div className="action-card">
                  <h3 className="section-title">Next move</h3>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => void runPost(`/api/rooms/${snapshot.room.id}/rematch`)}
                    disabled={loading}
                  >
                    Start a fresh round
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {fightStage || matchResolved ? (
            <section className="surface surface--utility utility-panel">
              <div className="utility-header">
                <h3 className="section-title">Corner feed</h3>
                <p className="muted">Everyone sees the barks. That is the point.</p>
              </div>
              <div className="timeline">
                {snapshot.commandFeed.length === 0 ? (
                  <p className="muted">No live commands yet.</p>
                ) : (
                  snapshot.commandFeed.map((command) => (
                    <article className="turn-card turn-card--command" key={command.id}>
                      <h4>
                        {command.playerName} · {command.phase} · {command.label}
                      </h4>
                      <p>
                        Cost {command.cost}. Energy left {command.energyAfter}.
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {(fightStage || matchResolved) && snapshot.turnLog.length > 0 ? (
            <section className="surface surface--utility utility-panel">
              <div className="utility-header">
                <h3 className="section-title">Fight transcript</h3>
                <p className="muted">
                  Live turns resolve after each bell. The transcript shows which corner calls actually stuck.
                </p>
              </div>
              <div className="timeline">
                {snapshot.turnLog.map((turn) => (
                  <article className="turn-card" key={turn.id}>
                    <h4>
                      {turn.playerName} · {turn.agentId} · {turn.phase}
                    </h4>
                    <p>{turn.content}</p>
                    <p className="turn-score">
                      {turn.swingTag}
                      {matchResolved ? ` · Score ${turn.microScore}` : ""}
                    </p>
                  </article>
                ))}
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

          {(fightStage || matchResolved || stageKey === "abandoned") ? (
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
          <section className="surface surface--secondary roster-panel entry-module">
            <div className="utility-header utility-header--stacked">
              <h3 className="section-title">Corners</h3>
              <p className="muted">
                Setup shows the fighter’s public lane. The live fight shows whether the coach can actually steer.
              </p>
            </div>
            <div className="roster-list">
              {snapshot.players.map((player) => (
                <div
                  className={`agent-card roster-card agent-card--${player.agent?.id ?? "Bruiser"} ${player.id === snapshot.viewerPlayerId ? "agent-card--viewer" : ""}`}
                  key={player.id}
                >
                  <div className="roster-card__identity">
                    <small>{player.id === snapshot.viewerPlayerId ? "You" : "Opponent"}</small>
                    <h3>{player.name}</h3>
                    <p className="roster-card__state">
                      {matchResolved
                        ? `${player.rigLabel ?? "Unscored"} · Rig score ${player.rigScore !== null ? `${player.rigScore > 0 ? "+" : ""}${player.rigScore}` : "?"}`
                        : player.agent
                          ? `Agent: ${player.agent.name}`
                          : "Agent pending"}
                    </p>
                  </div>
                  <p className="muted roster-card__summary">
                    {matchResolved
                      ? `${player.rigLabel ?? "Unscored"} · Expected ${player.expectedScore ?? "?"} · Actual ${player.actualScore ?? "?"}`
                      : player.agent?.publicHint ?? "Agent assignment unlocks once both sides are ready."}
                  </p>
                  <div className="status-strip roster-card__chips">
                    <span className="status-badge">{player.ready ? "Ready" : "Not ready"}</span>
                    {(setupOpen || fightStage || matchResolved) ? (
                      <span className="status-badge">
                        {player.submittedSetup ? "Setup locked" : "Setup open"}
                      </span>
                    ) : null}
                    {(fightStage || matchResolved) ? (
                      <span className="status-badge">Energy {player.cornerEnergy}</span>
                    ) : null}
                    {player.disconnected ? (
                      <span className="status-badge status-badge--warning">Disconnected</span>
                    ) : null}
                  </div>
                  {player.agent && !matchResolved ? (
                    <>
                      <ul className="list">
                        {player.agent.visibleTraits.map((trait) => (
                          <li key={trait}>{trait}</li>
                        ))}
                      </ul>
                      <p className="muted roster-card__danger">Danger: {player.agent.publicDanger}</p>
                    </>
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
