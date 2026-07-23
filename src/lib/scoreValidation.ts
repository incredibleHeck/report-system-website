/**
 * Maxima for teacher-entered scores.
 *
 * EOT scored subjects: teachers enter RAW marks; the system scales to report
 * contributions (CW→20, MT→20, Exam→60). Empty cells count as 0 when scaling
 * (no N/A / adjusted denominators in this phase).
 *
 * SCORE_FIELD_MAX.cw/mt/eot remain the scaled report maxima for legacy paths.
 */

/** Scaled report-component maxima (stored on AssessmentScore after scaling). */
export const SCORE_FIELD_MAX = {
  cw: 20,
  mt: 20,
  eot: 60,
  /** Midterm-mode / score-only subjects: single total out of 100 */
  total: 100,
} as const;

/** Raw entry maxima for EOT scored subjects. */
export const RAW_SCORE_MAX = {
  /** Each of 5 classwork slots */
  cwSlot: 10,
  /** Midterm split components */
  mtA: 30,
  mtB: 30,
  mtC: 40,
  /** Midterm single test */
  mtSingle: 100,
  /** End-of-term exam (scaled to /60) */
  exam: 100,
  /** Denominator for CW sum (5 × 10) */
  cwSum: 50,
  /** Denominator for midterm raw */
  mtSum: 100,
} as const;

export type ScoreFieldKey = keyof typeof SCORE_FIELD_MAX;

const PARTIAL_SCORE = /^\d*\.?\d*$/;

/**
 * Sanitize a score input string for a field with a given max.
 * Blank stays blank (missing). Over-max / under-0 are clamped.
 * Non-numeric keystrokes set `reject` so the caller keeps the previous value.
 */
export function sanitizeScoreInput(
  raw: string,
  max: number
): { value: string; error?: string; reject?: boolean } {
  if (raw === '') return { value: '' };

  if (!PARTIAL_SCORE.test(raw)) {
    return { value: '', reject: true, error: `Enter a number from 0 to ${max}` };
  }

  if (raw === '.' || raw.endsWith('.')) {
    const head = raw.slice(0, -1);
    if (head === '') return { value: raw };
    const n = Number(head);
    if (n > max) return { value: String(max), error: `Maximum is ${max}` };
    return { value: raw };
  }

  const n = Number(raw);
  if (Number.isNaN(n)) {
    return { value: '', reject: true, error: `Enter a number from 0 to ${max}` };
  }
  if (n < 0) {
    return { value: '0', error: 'Minimum is 0' };
  }
  if (n > max) {
    return { value: String(max), error: `Maximum is ${max}` };
  }
  return { value: raw };
}

/** Clamp a numeric score into [0, max]. Empty/NaN → 0 for calc/save. */
export function clampScore(value: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, n));
}

/** Parse a draft string to a number or null (blank). */
export function parseOptionalScore(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === '' || raw === '.') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}
