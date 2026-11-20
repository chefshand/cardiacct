// SM-2-style spaced repetition. Grades: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy.
export type SrsState = { ease: number; interval_days: number; reps: number; lapses?: number };
export type SrsResult = SrsState & { due_at: Date; lapses: number };

const MIN_EASE = 1.3;

export function schedule(s: SrsState, grade: 0 | 1 | 2 | 3, now = new Date()): SrsResult {
  let { ease, interval_days, reps } = s;
  let lapses = s.lapses ?? 0;

  if (grade === 0) {
    lapses += 1;
    reps = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    interval_days = 0;
    return { ease, interval_days, reps, lapses, due_at: new Date(now.getTime() + 10 * 60 * 1000) };
  }

  if (reps === 0) interval_days = grade === 3 ? 3 : 1;
  else if (reps === 1) interval_days = grade === 1 ? 3 : grade === 2 ? 6 : 8;
  else interval_days = interval_days * ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1);

  if (grade === 1) ease = Math.max(MIN_EASE, ease - 0.15);
  if (grade === 3) ease = ease + 0.15;
  reps += 1;
  interval_days = Math.min(Math.round(interval_days * 10) / 10, 365);
  return { ease, interval_days, reps, lapses, due_at: new Date(now.getTime() + interval_days * 86400000) };
}

/** Questions: correct ≈ Good, incorrect → back tomorrow. */
export function scheduleQuestion(s: SrsState, correct: boolean, now = new Date()): SrsResult {
  if (correct) return schedule(s, 2, now);
  const r = schedule(s, 0, now);
  return { ...r, due_at: new Date(now.getTime() + 86400000) };
}
