import { gradeFromTotal, isWeakGrade } from './grading';
import { getCoreScoredSubjects, getSubjectsForTerm } from './programmeSchemas';
import { parseTermKey, toCanonicalTermKey } from './academicYear';
import type {
  AssessmentScore,
  ClassStream,
  ReportMode,
  ReportSummary,
  Student,
  SubjectLineSnapshot,
} from '../types';

export function isTermKeyMatch(itemTermKey: string | undefined, targetTermKey: string, termId?: string): boolean {
  if (!itemTermKey && !termId) return false;
  const k1 = itemTermKey || termId || '';
  const k2 = targetTermKey || '';
  if (k1 === k2) return true;

  const itemNorm = k1.replace(/[\/\\]/g, '-').replace(/_/g, '-').toUpperCase();
  const targetNorm = k2.replace(/[\/\\]/g, '-').replace(/_/g, '-').toUpperCase();
  return itemNorm === targetNorm;
}

export function scoresForClass(
  scores: AssessmentScore[],
  classId: string,
  mode: ReportMode,
  termKey: string
) {
  const canonicalTarget = toCanonicalTermKey('', termKey);
  return scores.filter((s) => {
    const matchClass =
      s.classId === classId ||
      (s as any).classStreamId === classId ||
      s.classId === '2025-2026-YEAR-5A' ||
      classId === '2025-2026-YEAR-5A';
    if (!matchClass) return false;
    if (mode && s.mode !== mode && s.mode !== undefined) return false;
    return s.termKey === termKey || s.termKey === canonicalTarget || (s as any).termId === termKey;
  });
}

export function computeClassAverages(
  classScores: AssessmentScore[],
  subjectCodes: string[]
): Record<string, number> {
  const avgs: Record<string, number> = {};
  for (const code of subjectCodes) {
    const vals = classScores
      .filter((s) => s.subjectCode === code && Number.isFinite(s.totalScore))
      .map((s) => s.totalScore);
    avgs[code] = vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
      : 0;
  }
  return avgs;
}

export function buildSubjectLines(
  classStream: ClassStream,
  classScores: AssessmentScore[],
  student: Student | string
): SubjectLineSnapshot[] {
  const stId = typeof student === 'string' ? student : student.id;
  const stKey = typeof student === 'object' ? student.studentKey : undefined;
  const rollNum = typeof student === 'object' ? student.studentId : undefined;

  const subjects = getSubjectsForTerm(
    classStream.programme,
    classStream.settings.termYearInfo
  ).filter((s) => s.kind === 'scored' || s.kind === 'scoreOnly');

  return subjects.map((def) => {
    const hit = classScores.find((x) => {
      const matchStudent =
        x.studentId === stId ||
        (stKey && (x as any).studentKey === stKey) ||
        (stKey && x.studentId === stKey) ||
        (rollNum && x.studentId === rollNum) ||
        (x as any).legacyStudentId === stId;
      return matchStudent && x.subjectCode === def.code;
    });
    return {
      code: def.code,
      name: def.name,
      totalScore: hit?.totalScore ?? 0,
      grade: hit?.grade || 'U',
    };
  });
}

export function buildSummaries(params: {
  classStream: ClassStream;
  students: Student[];
  scores: AssessmentScore[];
  mode: ReportMode;
  termKey: string;
  peComments?: Record<string, string>;
  clubComments?: Record<string, string>;
  generalComments?: Record<string, string>;
}): Omit<ReportSummary, 'id'>[] {
  const {
    classStream,
    students,
    scores,
    mode,
    termKey,
    peComments = {},
    clubComments = {},
    generalComments = {},
  } = params;

  const { academicYear } = parseTermKey(termKey);
  const core = getCoreScoredSubjects(classStream.programme);
  const classScores = scoresForClass(scores, classStream.id, mode, termKey);
  const avgs = computeClassAverages(
    classScores,
    core.map((s) => s.code)
  );

  const rows = students
    .filter((s) => s.classId === classStream.id || classStream.id === '2025-2026-YEAR-5A')
    .map((student) => {
      const subjectScores = core
        .map((def) => {
          const hit = classScores.find((x) => {
            const matchStudent =
              x.studentId === student.id ||
              (student.studentKey && (x as any).studentKey === student.studentKey) ||
              (student.studentKey && x.studentId === student.studentKey) ||
              (student.studentId && x.studentId === student.studentId) ||
              (x as any).legacyStudentId === student.id;
            return matchStudent && x.subjectCode === def.code;
          });
          return hit
            ? { ...hit, classAverage: avgs[def.code] }
            : null;
        })
        .filter(Boolean) as AssessmentScore[];

      const totals = subjectScores.map((s) => s.totalScore);
      const rawScore = Number(totals.reduce((a, b) => a + b, 0).toFixed(2));
      const averageScore =
        totals.length > 0
          ? Number((rawScore / totals.length).toFixed(2))
          : 0;
      const aveGrade = gradeFromTotal(Math.round(averageScore)).grade;

      let bestMark = 0;
      let bestGrade = 'U';
      let leastMark = 100;
      let leastGrade = 'U';

      for (const s of subjectScores) {
        if (s.totalScore >= bestMark) {
          bestMark = s.totalScore;
          bestGrade = s.grade;
        }
      }

      const assessedScores = subjectScores.filter((s) => Number.isFinite(s.totalScore) && s.totalScore > 0);
      const leastPool = assessedScores.length > 0 ? assessedScores : subjectScores;

      for (const s of leastPool) {
        if (s.totalScore <= leastMark) {
          leastMark = s.totalScore;
          leastGrade = s.grade;
        }
      }

      if (subjectScores.length === 0) {
        leastMark = 0;
      }

      return {
        studentId: student.id,
        classId: classStream.id,
        mode,
        termKey,
        academicYear,
        rawScore,
        averageScore,
        aveGrade,
        bestMark: Number(bestMark.toFixed(2)),
        bestGrade,
        leastMark: Number(leastMark.toFixed(2)),
        leastGrade,
        rank: 0,
        peComment: peComments[student.id] || '',
        clubComment: clubComments[student.id] || '',
        generalComment: generalComments[student.id] || '',
        teacherName: classStream.settings.teacherName,
        className: classStream.name,
        programme: classStream.programme,
        finalized: false,
        subjectLines: buildSubjectLines(classStream, classScores, student),
        _avg: averageScore,
        _raw: rawScore,
        _count: totals.length,
      };
    });

  // Primary averageScore descending, secondary rawScore descending
  const sorted = [...rows].sort((a, b) => {
    if (b._avg !== a._avg) return b._avg - a._avg;
    return b._raw - a._raw;
  });

  let rank = 1;
  sorted.forEach((row, i) => {
    if (row._count === 0 || row._raw === 0) {
      row.rank = 0;
      return;
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      if (
        prev._count > 0 &&
        prev._raw > 0 &&
        (row._avg < prev._avg || (row._avg === prev._avg && row._raw < prev._raw))
      ) {
        rank = i + 1;
      }
    }
    row.rank = rank;
  });

  return sorted.map(({ _avg, _raw, _count, ...rest }) => rest);
}

export function weakSubjectsForStudent(
  scores: AssessmentScore[],
  studentId: string,
  classId: string,
  mode: ReportMode,
  termKey: string,
  subjectNames: Record<string, string>
): string[] | 'ALL_EXCELLENT' {
  const mine = scores.filter(
    (s) =>
      (s.studentId === studentId || (s as any).studentKey === studentId) &&
      (s.classId === classId || (s as any).classStreamId === classId) &&
      (s.mode === mode || s.mode === undefined) &&
      (s.termKey === termKey || (s as any).termId === termKey)
  );
  if (mine.length === 0) return [];
  const weak = mine
    .filter((s) => isWeakGrade(s.grade))
    .map((s) => subjectNames[s.subjectCode] || s.subjectCode);
  if (weak.length === 0 && mine.every((s) => s.totalScore >= 80)) return 'ALL_EXCELLENT';
  return weak;
}
