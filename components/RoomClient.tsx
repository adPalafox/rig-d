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
  const diff = Math.max(-20, Math.min(20, left - right));
  return {
    left: Math.max(10, Math.min(90, 50 + diff * 2)),
    right: Math.max(10, Math.min(90, 50 - diff * 2)),
  };
}

function ringTransform(position: number, side: "left" | "right") {
  const signed = side === "left" ? position : -position;
  return `translateX(${signed * 5}px)`;
}

function impactCopy(impact: string) {
  if (impact === "hit") return "Landed clean";
  if (impact === "whiff") return "Whiffed";
  if (impact === "block") return "Absorbed it";
  if (impact === "hype") return "Crowd popped";
  if (impact === "crash") return "Nearly collapsed";
  return "Reset";
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
      const response = await fetch(`/api/matches/${snapshot.match.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const json = (await response.json()) as MatchSnapshot;
      setSnapshot(json);
      setSecondsLeft(countdownRemaining(json.match.setupDeadlineAt ?? json.match.phaseDeadlineAt));
    }, 700);
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
  const setupOpen = stageKey === "setup";
  const fightStage = stageKey === "live";
  const liveOpen = snapshot.match.state === "live_phase_open";
  const matchResolved = stageKey === "reveal";
  const canReady = stageKey === "lobby" && viewer !== null;
  const momentumSplit = scoreMomentum(viewer?.momentum ?? 0, opponent?.momentum ?? 0);
  const winner =
    snapshot.players.find((player) => player.id === snapshot.judgeResult?.winnerPlayerId) ?? null;
  const latestBeat = snapshot.arenaTimeline[0] ?? null;

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

  const phaseCopy = {
    lobby: {
      label: "Lobby",
      title: opponent ? "Get both coaches in the room" : "Waiting for the second coach",
      description: opponent
        ? "Once both sides are ready, the arena draws fighters and the room starts barking."
        : "Share the invite and drag your opponent into the ring.",
    },
    setup: {
      label: "Corner Setup",
      title: viewer?.submittedSetup ? "Your stance is locked" : "Set the fighter stance fast",
      description: viewer?.submittedSetup
        ? "You are locked in. Once the other corner settles or time burns out, the fight starts."
        : "Pick how the fighter enters, how it handles pressure, and how dumb you want the chaos to get.",
    },
    live: {
      label: snapshot.match.state === "judging" ? "Replaying Damage" : formatPhaseLabel(snapshot.match.currentPhase),
      title:
        snapshot.match.state === "judging"
          ? "The room is deciding who owned the chaos"
          : `${formatPhaseLabel(snapshot.match.currentPhase)} bell`,
      description:
        snapshot.match.state === "judging"
          ? "The exchange is over. The ring is cooling off while the result settles."
          : "Stop staring at the feed. Click something that changes the ring right now.",
    },
    reveal: {
      label: "Finish",
      title: winner ? `${winner.name} took the room` : "The room chose a winner",
      description:
        snapshot.judgeResult?.coachingImpactSummary ??
        "Somebody controlled the ring better than the other side.",
    },
    abandoned: {
      label: "Interrupted",
      title: "The room fell apart before the finish",
      description: "One coach disappeared long enough to kill the round.",
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
              Series: {snapshot.room.rivalry.roundsPlayed} rounds
            </span>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-box summary-box--wide">
            <small>Share link</small>
            <strong className="inline-code room-link">{snapshot.room.shareUrl}</strong>
          </div>
          <div className="summary-box">
            <small>Clock</small>
            <strong>{secondsLeft}s</strong>
            <p>{setupOpen ? "Lock stance fast." : fightStage ? "Bell is open." : "Waiting on action."}</p>
          </div>
          <div className="summary-box">
            <small>Current beat</small>
            <strong>{snapshot.match.currentBeat}</strong>
            <p>{fightStage ? "Each bark should move the ring." : "No beats yet."}</p>
          </div>
          <div className="summary-box">
            <small>Matchup</small>
            <strong>{viewer?.name ?? "You"} vs {opponent?.name ?? "Waiting"}</strong>
            <p>{snapshot.match.topic.title}</p>
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
                { key: "reveal" as StageKey, label: "Finish" },
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
                  <h3 className="section-title">Room rules</h3>
                  <ul className="list">
                    <li>Two coaches enter.</li>
                    <li>Both lock ready.</li>
                    <li>The arena assigns fighters and the ring turns noisy fast.</li>
                  </ul>
                </div>
                <div className="action-card">
                  <h3 className="section-title">Ready checkpoint</h3>
                  <p className="muted">
                    {opponent ? "Ready up and get to the part where the ring actually moves." : "Your opponent still needs to join."}
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
                        fightState={viewer.fighterState}
                        fighterAction={viewer.fighterAction}
                      />
                    </div>
                    <div className="agent-card__header">
                      <div>
                        <small>Your fighter</small>
                        <h3>{viewer.agent?.name ?? "Agent incoming"}</h3>
                      </div>
                      <span className="meta-pill">{viewer.name}</span>
                    </div>
                    <p className="muted">{viewer.agent?.flavor}</p>
                    {viewer.agent ? (
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
                    ) : null}
                  </div>
                </div>

                <div className="coach-form-shell">
                  {viewer.submittedSetup ? (
                    <div className="success-box">Your stance is locked. Wait for the bell or the other corner.</div>
                  ) : (
                    <div className="form form--setup">
                      <div className="form-cluster">
                        <div>
                          <h3 className="section-title">Entrance</h3>
                          <p className="muted">How does your fighter enter the mess?</p>
                        </div>
                        <div className="choice-grid">
                          {OPENING_STYLE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`choice-chip ${setupDraft.openingStyle === option.id ? "choice-chip--selected" : ""}`}
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
                          <p className="muted">What should your corner yell when things get ugly?</p>
                        </div>
                        <div className="choice-grid">
                          {PRESSURE_RULE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`choice-chip ${setupDraft.pressureRule === option.id ? "choice-chip--selected" : ""}`}
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
                          <h3 className="section-title">Chaos level</h3>
                          <p className="muted">How stupid are you willing to let this get?</p>
                        </div>
                        <div className="choice-grid">
                          {RISK_LEVEL_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`choice-chip ${setupDraft.riskLevel === option.id ? "choice-chip--selected" : ""}`}
                              onClick={() => setSetupDraft((prev) => ({ ...prev, riskLevel: option.id }))}
                            >
                              <strong>{option.label}</strong>
                              <span>{option.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-field">
                        <label htmlFor="signatureLine">Crowd line</label>
                        <input
                          id="signatureLine"
                          maxLength={64}
                          value={setupDraft.signatureLine ?? ""}
                          placeholder="Break their feet before they break your nerve."
                          onChange={(event) => setSetupDraft((prev) => ({ ...prev, signatureLine: event.target.value }))}
                        />
                      </div>

                      <div className="button-row">
                        <button
                          className="button"
                          type="button"
                          onClick={async () => {
                            const result = await runPost(`/api/matches/${snapshot.match.id}/coaching`, setupDraft);
                            if (result) setMessage("Corner stance locked.");
                          }}
                          disabled={loading}
                        >
                          Lock stance
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {fightStage && viewer && opponent ? (
              <div className="live-corner-shell live-corner-shell--boxing">
                <div className="arena-board">
                  <div className="arena-board__hud">
                    <div className="arena-hud-card">
                      <small>{viewer.name}</small>
                      <strong>{viewer.cornerEnergy}/5 energy</strong>
                      <p>{viewer.fighterState.replaceAll("_", " ")}</p>
                    </div>
                    <div className="arena-hud-card arena-hud-card--center">
                      <small>{snapshot.match.state === "judging" ? "Cooling off" : formatPhaseLabel(snapshot.match.currentPhase)}</small>
                      <strong>Beat {snapshot.match.currentBeat}</strong>
                      <p>{latestBeat?.swingTag ?? "Ring is waiting"}</p>
                    </div>
                    <div className="arena-hud-card">
                      <small>{opponent.name}</small>
                      <strong>{opponent.cornerEnergy}/5 energy</strong>
                      <p>{opponent.fighterState.replaceAll("_", " ")}</p>
                    </div>
                  </div>

                  <div className={`arena-board__ring ${latestBeat ? `arena-board__ring--${latestBeat.impactType}` : ""}`}>
                    <div className="arena-board__ropes arena-board__ropes--top" />
                    <div className="arena-board__ropes arena-board__ropes--bottom" />
                    <div className="arena-board__spotlight" />

                    <div className="arena-board__lane arena-board__lane--left">
                      <div className="arena-board__fighter" style={{ transform: ringTransform(viewer.ringPosition, "left") }}>
                        <AgentStickman
                          className="agent-stickman agent-stickman--arena"
                          color={viewer.agent?.bandanaColor ?? "#1e1b16"}
                          variant={viewer.agent?.id ?? "Bruiser"}
                          pose={viewer.fighterState === "rocked" ? "slump" : viewer.fighterState === "crowd_favorite" ? "victory" : "duel"}
                          emphasis={viewer.fighterState === "crowd_favorite" ? "burst" : "ring"}
                          fightState={viewer.fighterState}
                          fighterAction={viewer.fighterAction}
                        />
                        <div className="arena-board__caption">
                          <strong>{impactCopy(viewer.lastImpactType)}</strong>
                          <span>
                            Stagger {viewer.staggerLevel} · Hype {viewer.hypeLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="arena-board__centerline">
                      <div className="arena-board__momentum">
                        <div className="momentum-bar">
                          <div className="momentum-bar__lane momentum-bar__lane--left" style={{ width: `${momentumSplit.left}%` }} />
                          <div className="momentum-bar__lane momentum-bar__lane--right" style={{ width: `${momentumSplit.right}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="arena-board__lane arena-board__lane--right">
                      <div className="arena-board__fighter" style={{ transform: ringTransform(opponent.ringPosition, "right") }}>
                        <AgentStickman
                          className="agent-stickman agent-stickman--arena"
                          color={opponent.agent?.bandanaColor ?? "#5e574d"}
                          variant={opponent.agent?.id ?? "Showman"}
                          pose={opponent.fighterState === "rocked" ? "slump" : opponent.fighterState === "crowd_favorite" ? "victory" : "duel"}
                          emphasis={opponent.fighterState === "crowd_favorite" ? "burst" : "ring"}
                          fightState={opponent.fighterState}
                          fighterAction={opponent.fighterAction}
                          flipped
                        />
                        <div className="arena-board__caption">
                          <strong>{impactCopy(opponent.lastImpactType)}</strong>
                          <span>
                            Stagger {opponent.staggerLevel} · Hype {opponent.hypeLevel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="arena-board__callout">
                    <strong>{latestBeat?.commandLabel ?? "The bell is open."}</strong>
                    <p>{latestBeat?.commentary ?? "Throw a call that actually changes the ring."}</p>
                  </div>
                </div>

                <div className="command-grid command-grid--boxing">
                  {LIVE_COMMAND_DEFINITIONS.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      className={`command-chip command-chip--boxing ${
                        viewer.cornerEnergy < command.cost || !liveOpen ? "command-chip--disabled" : ""
                      }`}
                      disabled={loading || !liveOpen || viewer.cornerEnergy < command.cost}
                      onClick={async () => {
                        const result = await runPost(`/api/matches/${snapshot.match.id}/command`, {
                          commandId: command.id,
                        });
                        if (result) setMessage(`${command.label} changed the ring.`);
                      }}
                    >
                      <strong>{command.label}</strong>
                      <span>{command.description}</span>
                      <small>{command.cost} energy</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {matchResolved && snapshot.judgeResult && viewer && opponent ? (
              <div className="reveal-stack">
                <div className="fight-finish-panel">
                  <div className="fight-finish-panel__fighters">
                    <div className="fight-finish-panel__fighter">
                      <AgentStickman
                        className="agent-stickman agent-stickman--reveal"
                        color={winner?.agent?.bandanaColor ?? viewer.agent?.bandanaColor ?? "#1e1b16"}
                        variant={winner?.agent?.id ?? viewer.agent?.id ?? "Bruiser"}
                        pose="victory"
                        emphasis="burst"
                        fightState="crowd_favorite"
                        fighterAction="taunt"
                      />
                    </div>
                    <div className="fight-finish-panel__fighter fight-finish-panel__fighter--loser">
                      <AgentStickman
                        className="agent-stickman agent-stickman--reveal"
                        color={snapshot.players.find((player) => player.id !== winner?.id)?.agent?.bandanaColor ?? opponent.agent?.bandanaColor ?? "#5e574d"}
                        variant={snapshot.players.find((player) => player.id !== winner?.id)?.agent?.id ?? opponent.agent?.id ?? "Gremlin"}
                        pose="slump"
                        emphasis="ring"
                        fightState="rocked"
                        fighterAction="stumble"
                        flipped
                      />
                    </div>
                  </div>
                  <div className="fight-finish-panel__summary">
                    <small>Winner</small>
                    <h3>{winner?.name ?? "Unknown"}</h3>
                    <p>{snapshot.judgeResult.reasonSummary}</p>
                    <p className="reveal-impact-copy">{snapshot.judgeResult.coachingImpactSummary}</p>
                  </div>
                </div>

                {snapshot.judgeResult.decisiveMoment ? (
                  <div className="proof-card proof-card--decisive">
                    <small>Decisive moment</small>
                    <strong>{snapshot.judgeResult.decisiveMoment.summary}</strong>
                    <p>
                      {snapshot.judgeResult.decisiveMoment.commands
                        .map((commandId) => LIVE_COMMAND_DEFINITIONS.find((command) => command.id === commandId)?.label ?? commandId)
                        .join(" + ")}
                      {" "}snapped the room.
                    </p>
                  </div>
                ) : null}

                <div className="swing-replay-strip">
                  {snapshot.arenaTimeline.slice(0, 4).reverse().map((beat) => (
                    <article className={`swing-replay-strip__card swing-replay-strip__card--${beat.impactType}`} key={beat.id}>
                      <small>{beat.playerName}</small>
                      <strong>{beat.commandLabel}</strong>
                      <p>{beat.commentary}</p>
                    </article>
                  ))}
                </div>

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
                    Run it back
                  </button>
                </div>
              </div>
            ) : null}

            {stageKey === "abandoned" ? (
              <div className="stage-content">
                <div className="stage-subpanel">
                  <h3 className="section-title">Recovery</h3>
                  <p className="muted">The round died because a coach vanished too long.</p>
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

          {(fightStage || matchResolved) && snapshot.arenaTimeline.length > 0 ? (
            <section className="surface surface--utility utility-panel">
              <div className="utility-header">
                <h3 className="section-title">Arena replay</h3>
                <p className="muted">This is the real fight log now. The text exists to support what you saw in the ring.</p>
              </div>
              <div className="timeline">
                {snapshot.arenaTimeline.map((beat) => (
                  <article className={`turn-card turn-card--arena turn-card--${beat.impactType}`} key={beat.id}>
                    <h4>
                      Beat {beat.beatNumber} · {beat.playerName} · {beat.commandLabel}
                    </h4>
                    <p>{beat.commentary}</p>
                    <p className="turn-score">
                      {beat.fighterState.replaceAll("_", " ")} · {beat.fighterAction.replaceAll("_", " ")} · {beat.swingTag}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {matchResolved && snapshot.judgeResult ? (
            <section className="surface surface--utility utility-panel">
              <details className="detail-disclosure">
                <summary>Deep scoring</summary>
                <div className="detail-grid">
                  {snapshot.players.map((player) => {
                    const categories = snapshot.judgeResult?.scoresByCategory[player.id];
                    return (
                      <div className="event-card" key={player.id}>
                        <h4>{player.name}</h4>
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
        </main>

        <aside className="side-stack">
          <section className="surface surface--secondary roster-panel entry-module">
            <div className="utility-header utility-header--stacked">
              <h3 className="section-title">Corners</h3>
              <p className="muted">Read the fighter fast, then watch whether the room turns on them.</p>
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
                        ? `${player.rigLabel ?? "Unscored"} · Rig ${player.rigScore !== null ? `${player.rigScore > 0 ? "+" : ""}${player.rigScore}` : "?"}`
                        : `${player.fighterState.replaceAll("_", " ")} · ${player.fighterAction.replaceAll("_", " ")}`}
                    </p>
                  </div>
                  <p className="muted roster-card__summary">
                    {player.agent?.publicHint ?? "Agent assignment unlocks when both sides are ready."}
                  </p>
                  <div className="status-strip roster-card__chips">
                    <span className="status-badge">{player.ready ? "Ready" : "Not ready"}</span>
                    {(setupOpen || fightStage || matchResolved) ? (
                      <span className="status-badge">Energy {player.cornerEnergy}</span>
                    ) : null}
                    <span className="status-badge">
                      Ring {player.ringPosition > 0 ? `+${player.ringPosition}` : player.ringPosition}
                    </span>
                  </div>
                  {player.agent ? (
                    <p className="muted roster-card__danger">Danger: {player.agent.publicDanger}</p>
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
