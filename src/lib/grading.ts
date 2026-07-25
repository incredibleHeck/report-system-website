import {
  SCORE_FIELD_MAX,
  RAW_SCORE_MAX,
  clampScore,
} from './scoreValidation';
import type { MtEntryMode } from '../types';

/** Official SAIS A*–U bands from vault REPORT TEMPLATE */
export function gradeFromTotal(total: number): { grade: string; comment: string; isPass: boolean } {
  if (total >= 90) return { grade: 'A*', comment: 'EXCELLENT', isPass: true };
  if (total >= 80) return { grade: 'A', comment: 'VERY GOOD', isPass: true };
  if (total >= 70) return { grade: 'B', comment: 'GOOD', isPass: true };
  if (total >= 60) return { grade: 'C', comment: 'SATISFACTORY', isPass: true };
  if (total >= 50) return { grade: 'D', comment: 'PASS', isPass: true };
  if (total >= 40) return { grade: 'E', comment: 'BELOW AVERAGE', isPass: true };
  return { grade: 'U', comment: 'UNGRADED', isPass: false };
}

/** Round once at the final total stage before grade bands / report storage. */
export function roundFinalTotal(totalExact: number): number {
  return Math.round(totalExact);
}

function nullToZero(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  return n;
}

export type RawEotInput = {
  cwRaw?: (number | null | undefined)[] | null;
  mtEntryMode: MtEntryMode;
  mtRawSplit?: (number | null | undefined)[] | null;
  mtRawSingle?: number | null;
  examRaw?: number | null;
};

export type ScaledEotResult = {
  cwExact: number;
  mtExact: number;
  eotExact: number;
  totalExact: number;
  cw: number;
  mt: number;
  eot: number;
  totalScore: number;
  grade: string;
  comment: string;
  isPass: boolean;
  cwRaw: [number | null, number | null, number | null, number | null, number | null];
  mtRawSplit: [number | null, number | null, number | null];
  mtRawSingle: number | null;
  examRaw: number | null;
  mtEntryMode: MtEntryMode;
};

/**
 * Scale raw EOT marks → report components.
 * CW: sum of 5×/10 → /20. MT: /100 → /20. Exam: /100 → /60.
 * Components stay exact floats; only the final total is rounded for grade mapping.
 */
export function scaleRawEotComponents(input: RawEotInput): ScaledEotResult {
  const cwRaw: [number | null, number | null, number | null, number | null, number | null] = [
    0, 1, 2, 3, 4,
  ].map((i) => {
    const v = input.cwRaw?.[i];
    if (v === null || v === undefined) return null;
    return clampScore(v, RAW_SCORE_MAX.cwSlot);
  }) as [number | null, number | null, number | null, number | null, number | null];

  const cwSum = cwRaw.reduce((acc, v) => acc + nullToZero(v), 0);
  const cwExact = (cwSum / RAW_SCORE_MAX.cwSum) * SCORE_FIELD_MAX.cw;

  let mtRawSplit: [number | null, number | null, number | null] = [null, null, null];
  let mtRawSingle: number | null = null;
  let mtRaw = 0;

  if (input.mtEntryMode === 'split') {
    mtRawSplit = [
      input.mtRawSplit?.[0] == null
        ? null
        : clampScore(input.mtRawSplit[0], RAW_SCORE_MAX.mtA),
      input.mtRawSplit?.[1] == null
        ? null
        : clampScore(input.mtRawSplit[1], RAW_SCORE_MAX.mtB),
      input.mtRawSplit?.[2] == null
        ? null
        : clampScore(input.mtRawSplit[2], RAW_SCORE_MAX.mtC),
    ];
    mtRaw =
      nullToZero(mtRawSplit[0]) + nullToZero(mtRawSplit[1]) + nullToZero(mtRawSplit[2]);
  } else {
    mtRawSingle =
      input.mtRawSingle == null ? null : clampScore(input.mtRawSingle, RAW_SCORE_MAX.mtSingle);
    mtRaw = nullToZero(mtRawSingle);
  }

  const mtExact = (mtRaw / RAW_SCORE_MAX.mtSum) * SCORE_FIELD_MAX.mt;

  const examRaw =
    input.examRaw == null ? null : clampScore(input.examRaw, RAW_SCORE_MAX.exam);
  const eotExact = (nullToZero(examRaw) / RAW_SCORE_MAX.exam) * SCORE_FIELD_MAX.eot;

  const totalExact = cwExact + mtExact + eotExact;
  const totalScore = roundFinalTotal(totalExact);
  const { grade, comment, isPass } = gradeFromTotal(totalScore);

  return {
    cwExact,
    mtExact,
    eotExact,
    totalExact,
    cw: cwExact,
    mt: mtExact,
    eot: eotExact,
    totalScore,
    grade,
    comment,
    isPass,
    cwRaw,
    mtRawSplit,
    mtRawSingle,
    examRaw,
    mtEntryMode: input.mtEntryMode,
  };
}

/** True when any raw EOT field is present (teacher has activated raw entry). */
export function hasRawEotData(score: {
  cwRaw?: (number | null)[] | null;
  mtRawSplit?: (number | null)[] | null;
  mtRawSingle?: number | null;
  examRaw?: number | null;
}): boolean {
  if (score.cwRaw?.some((v) => v !== null && v !== undefined)) return true;
  if (score.mtRawSplit?.some((v) => v !== null && v !== undefined)) return true;
  if (score.mtRawSingle !== null && score.mtRawSingle !== undefined) return true;
  if (score.examRaw !== null && score.examRaw !== undefined) return true;
  return false;
}

/** Format a scaled contribution for teacher feedback (e.g. 16.8/20). */
export function formatScaledHint(exact: number, max: number): string {
  const n = Math.round(exact * 100) / 100;
  return `${n}/${max}`;
}

/** EOT scored subjects: components are already scaled (CW/20 + MT/20 + EOT/60). */
export function calculateGrade(cw: number, mt: number, eot: number) {
  const c = clampScore(cw, SCORE_FIELD_MAX.cw);
  const m = clampScore(mt, SCORE_FIELD_MAX.mt);
  const e = clampScore(eot, SCORE_FIELD_MAX.eot);
  const totalExact = c + m + e;
  const totalScore = roundFinalTotal(totalExact);
  const { grade, comment, isPass } = gradeFromTotal(totalScore);
  return { totalScore, grade, comment, isPass, cw: c, mt: m, eot: e };
}

export function calculateScoreOnlyGrade(total: number) {
  const t = clampScore(total, SCORE_FIELD_MAX.total);
  const totalScore = roundFinalTotal(t);
  const { grade, comment, isPass } = gradeFromTotal(totalScore);
  return { totalScore, grade, comment, isPass };
}

export function performanceBand(average: number): string {
  if (average >= 80) return 'Excellent';
  if (average >= 70) return 'Above Average';
  if (average >= 60) return 'Average';
  return 'Below Average';
}

export function isWeakGrade(grade: string): boolean {
  return ['C', 'D', 'E', 'U'].includes(grade);
}

export const GRADING_LEGEND = [
  { range: '90 – 100', grade: 'A*', label: 'EXCELLENT' },
  { range: '80 – 89.99', grade: 'A', label: 'VERY GOOD' },
  { range: '70 – 79.99', grade: 'B', label: 'GOOD' },
  { range: '60 – 69.99', grade: 'C', label: 'SATISFACTORY' },
  { range: '50 – 59.99', grade: 'D', label: 'PASS' },
  { range: '40 – 49.99', grade: 'E', label: 'BELOW AVERAGE' },
  { range: '0 – 39.99', grade: 'U', label: 'UNGRADED' },
];

export type SubjectMarkInput = {
  cw1?: number | string | null;
  cw2?: number | string | null;
  cw3?: number | string | null;
  cw4?: number | string | null;
  cw5?: number | string | null;
  mtEntryMode?: MtEntryMode;
  mt1?: number | string | null;
  mt2?: number | string | null;
  mt3?: number | string | null;
  mtSingle?: number | string | null;
  exam?: number | string | null;
};

export type CalculatedSubjectScore = {
  cwTotal: number;
  cwScaled: number;
  mtRaw: number;
  mtScaled: number;
  examRaw: number;
  examScaled: number;
  totalScore: number;
  grade: string;
  gradeComment: string;
  isPass: boolean;
};

/**
 * Pure calculation helper function for SAIS subject final score & grade.
 * - Class Assessment (20%): CW1..CW5 (each /10) -> CW Total (/50) -> CW Scaled = (CW Total / 50) * 20 (rounded to 1 decimal place)
 * - Midterm Assessment (20%): Split (30+30+40) or Single (/100) -> Midterm Raw (/100) -> Midterm Scaled = (Midterm Raw / 100) * 20 (rounded to 1 decimal place)
 * - Examination (60%): Exam Score (/100) -> Exam Scaled = (Exam Score / 100) * 60 (rounded to 1 decimal place)
 * - Total Score (/100): CW Scaled + Midterm Scaled + Exam Scaled (rounded to 1 decimal place)
 * - Grade: Derived from central SAIS grading scale
 */
export function calculateSubjectFinalScore(input: SubjectMarkInput): CalculatedSubjectScore {
  const parseVal = (v: number | string | null | undefined, max: number): number => {
    if (v === null || v === undefined || v === '') return 0;
    const num = typeof v === 'number' ? v : parseFloat(String(v));
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(max, num));
  };

  const cw1 = parseVal(input.cw1, 10);
  const cw2 = parseVal(input.cw2, 10);
  const cw3 = parseVal(input.cw3, 10);
  const cw4 = parseVal(input.cw4, 10);
  const cw5 = parseVal(input.cw5, 10);

  const cwTotal = cw1 + cw2 + cw3 + cw4 + cw5;
  const cwScaled = Number(((cwTotal / 50) * 20).toFixed(1));

  const mode = input.mtEntryMode || 'split';
  let mtRaw = 0;

  if (mode === 'split') {
    const mt1 = parseVal(input.mt1, 30);
    const mt2 = parseVal(input.mt2, 30);
    const mt3 = parseVal(input.mt3, 40);
    mtRaw = mt1 + mt2 + mt3;
  } else {
    mtRaw = parseVal(input.mtSingle, 100);
  }

  const mtScaled = Number(((mtRaw / 100) * 20).toFixed(1));

  const examRaw = parseVal(input.exam, 100);
  const examScaled = Number(((examRaw / 100) * 60).toFixed(1));

  const totalScore = Number((cwScaled + mtScaled + examScaled).toFixed(1));
  const { grade, comment: gradeComment, isPass } = gradeFromTotal(totalScore);

  return {
    cwTotal,
    cwScaled,
    mtRaw,
    mtScaled,
    examRaw,
    examScaled,
    totalScore,
    grade,
    gradeComment,
    isPass,
  };
}
