export function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function roomCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function shuffle<T>(input: T[]) {
  const next = [...input];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function scoreLabel(score: number) {
  if (score >= 10) return "Breakout";
  if (score <= -6) return "Underperformed";
  return "On Par";
}

export function countdownRemaining(deadlineAt: number | null) {
  if (!deadlineAt) return 0;
  return Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
}
