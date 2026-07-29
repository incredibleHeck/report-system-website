import { gradeFromTotal } from './grading';
import type {
  AssessmentScore,
  ClassStream,
  MtEntryMode,
  ReportMode,
  ReportSummary,
  Student,
  SubjectDefinition,
} from '../types';

export interface AcademicMarkCalculationInput {
  cw1?: number | null;
  cw2?: number | null;
  cw3?: number | null;
  cw4?: number | null;
  cw5?: number | null;
  mtEntryMode?: MtEntryMode;
  mt1?: number | null;
  mt2?: number | null;
  mt3?: number | null;
  mtSingle?: number | null;
  exam?: number | null;
}

export interface AcademicMarkCalculationResult {
  cwTotal: number;
  cwScaled: number;
  mtRaw: number;
  mtScaled: number;
  examRaw: number;
  examScaled: number;
  totalScore: number;
  grade: string;
  comment: string;
}

export interface NonAcademicMarkCalculationInput {
  rating?: number | null;
}

export interface NonAcademicMarkCalculationResult {
  rating: number;
  totalScore: number;
  grade: string;
  comment: string;
}

/**
 * Pure calculation helper for Academic Subject 20 / 20 / 60 assessment scaling.
 * - Classwork: 5 components /10 each -> CW Total /50 -> CW Scaled /20
 * - Midterm: 3 components (30/30/40) or 1 single (/100) -> MT Raw /100 -> MT Scaled /20
 * - Exam: Exam Score /100 -> Exam Scaled /60
 * - Total Score /100: CW Scaled + MT Scaled + Exam Scaled
 */
export function calculateAcademicSubjectMarks(
  input: AcademicMarkCalculationInput
): AcademicMarkCalculationResult {
  const parseVal = (v: number | null | undefined, max: number): number => {
    if (v === null || v === undefined || isNaN(v)) return 0;
    return Math.max(0, Math.min(max, v));
  };

  const cw1 = parseVal(input.cw1, 10);
  const cw2 = parseVal(input.cw2, 10);
  const cw3 = parseVal(input.cw3, 10);
  const cw4 = parseVal(input.cw4, 10);
  const cw5 = parseVal(input.cw5, 10);

  const cwTotal = cw1 + cw2 + cw3 + cw4 + cw5;
  const cwScaled = Number(((cwTotal / 50) * 20).toFixed(1));

  const mtMode = input.mtEntryMode || 'split';
  let mtRaw = 0;
  if (mtMode === 'split') {
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
  const { grade, comment } = gradeFromTotal(totalScore);

  return {
    cwTotal,
    cwScaled,
    mtRaw,
    mtScaled,
    examRaw,
    examScaled,
    totalScore,
    grade,
    comment,
  };
}

/**
 * Pure calculation helper for Non-Academic / Activity subjects (PE, MUSIC, CLUBS, PROJECT).
 */
export function calculateNonAcademicSubjectMarks(
  input: NonAcademicMarkCalculationInput
): NonAcademicMarkCalculationResult {
  const rating =
    input.rating === null || input.rating === undefined || isNaN(input.rating)
      ? 0
      : Math.max(0, Math.min(100, input.rating));
  const totalScore = Number(rating.toFixed(1));
  const { grade, comment } = gradeFromTotal(totalScore);

  return {
    rating,
    totalScore,
    grade,
    comment,
  };
}

export interface MasterRowCalculated {
  studentId: string;
  rawScore: number;
  averageScore: number;
  aveGrade: string;
  bestMark: number;
  bestGrade: string;
  leastMark: number;
  leastGrade: string;
  rank: number;
  formattedRank?: string;
}

/**
 * Formats a 1-based integer rank as a standard ordinal string (e.g. 1st, 2nd, 3rd, 4th, 11th, 21st).
 */
export function formatOrdinalRank(rank: number): string {
  if (!rank || rank <= 0 || !Number.isFinite(rank)) return '-';
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) {
    return `${rank}st`;
  }
  if (j === 2 && k !== 12) {
    return `${rank}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${rank}rd`;
  }
  return `${rank}th`;
}

/**
 * Computes Master Sheet stream-wide analytics and automated ranks for a list of students.
 */
export function calculateStreamOverviewAnalytics(
  students: Student[],
  scores: AssessmentScore[],
  academicSubjects: SubjectDefinition[]
): Record<string, MasterRowCalculated> {
  const acadCodes = academicSubjects.map((s) => s.code);

  const rowDataList = students.map((st) => {
    const studentScores = scores.filter(
      (s) =>
        (s.studentId === st.id ||
          (s as any).studentKey === st.studentKey ||
          (s as any).studentKey === st.id ||
          s.studentId === st.studentKey ||
          (s as any).legacyStudentId === st.studentId ||
          (s as any).legacyStudentId === st.id) &&
        acadCodes.includes(s.subjectCode)
    );

    let rawScore = 0;
    let bestMark = -1;
    let bestGrade = 'U';
    let leastMark = 101;
    let leastGrade = 'U';

    if (studentScores.length > 0) {
      studentScores.forEach((sc) => {
        const val = sc.totalScore ?? 0;
        rawScore += val;
        if (val > bestMark) {
          bestMark = val;
          bestGrade = sc.grade || gradeFromTotal(val).grade;
        }
        if (val < leastMark) {
          leastMark = val;
          leastGrade = sc.grade || gradeFromTotal(val).grade;
        }
      });
    }

    if (bestMark === -1) {
      bestMark = 0;
      bestGrade = 'U';
    }
    if (leastMark === 101) {
      leastMark = 0;
      leastGrade = 'U';
    }

    const subjectCount = acadCodes.length || 1;
    const averageScore = Number((rawScore / subjectCount).toFixed(2));
    const aveGrade = gradeFromTotal(averageScore).grade;

    return {
      studentId: st.id,
      rawScore: Number(rawScore.toFixed(1)),
      averageScore,
      aveGrade,
      bestMark: Number(bestMark.toFixed(1)),
      bestGrade,
      leastMark: Number(leastMark.toFixed(1)),
      leastGrade,
      rank: 0,
      formattedRank: '-',
    };
  });

  // Ranks sorting (Descending average score with standard competition tie-breaking: 1st, 1st, 3rd)
  const sorted = [...rowDataList].sort((a, b) => b.averageScore - a.averageScore);
  let currentRank = 1;
  sorted.forEach((item, index) => {
    if (index > 0 && item.averageScore < sorted[index - 1].averageScore) {
      currentRank = index + 1;
    }
    item.rank = currentRank;
    item.formattedRank = formatOrdinalRank(currentRank);
  });

  const resultMap: Record<string, MasterRowCalculated> = {};
  rowDataList.forEach((item) => {
    resultMap[item.studentId] = item;
  });

  return resultMap;
}

