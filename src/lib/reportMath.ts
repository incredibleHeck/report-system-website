import { gradeFromTotal, isWeakGrade } from './grading';
import { getCoreScoredSubjects, getSubjectsForTerm } from './programmeSchemas';
import { parseTermKey } from './academicYear';
import type {
  AssessmentScore,
  ClassStream,
  ReportMode,
  ReportSummary,
  Student,
  SubjectLineSnapshot,
} from '../types';

export function scoresForClass(
  scores: AssessmentScore[],
  classId: string,
  mode: ReportMode,
  termKey: string
) {
  return scores.filter(
    (s) => s.classId === classId && s.mode === mode && s.termKey === termKey
  );
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
  studentId: string
): SubjectLineSnapshot[] {
  const subjects = getSubjectsForTerm(
    classStream.programme,
    classStream.settings.termYearInfo
  ).filter((s) => s.kind === 'scored' || s.kind === 'scoreOnly');

  return subjects.map((def) => {
    const hit = classScores.find(
      (x) => x.studentId === studentId && x.subjectCode === def.code
    );
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
    .filter((s) => s.classId === classStream.id)
    .map((student) => {
      const subjectScores = core
        .map((def) => {
          const hit = classScores.find(
            (x) => x.studentId === student.id && x.subjectCode === def.code
          );
          return hit
            ? { ...hit, classAverage: avgs[def.code] }
            : null;
        })
        .filter(Boolean) as AssessmentScore[];

      const totals = subjectScores.map((s) => s.totalScore);
      const rawScore = totals.reduce((a, b) => a + b, 0);
      const averageScore =
        totals.length > 0
          ? Math.round((rawScore / totals.length) * 100) / 100
          : 0;
      const aveGrade = gradeFromTotal(averageScore).grade;

      let bestMark = 0;
      let bestGrade = 'U';
      let leastMark = 100;
      let leastGrade = 'U';
      for (const s of subjectScores) {
        if (s.totalScore >= bestMark) {
          bestMark = s.totalScore;
          bestGrade = s.grade;
        }
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
        bestMark,
        bestGrade,
        leastMark,
        leastGrade,
        rank: 0,
        peComment: peComments[student.id] || '',
        clubComment: clubComments[student.id] || '',
        generalComment: generalComments[student.id] || '',
        teacherName: classStream.settings.teacherName,
        className: classStream.name,
        programme: classStream.programme,
        finalized: false,
        subjectLines: buildSubjectLines(classStream, classScores, student.id),
        _avg: averageScore,
      };
    });

  const sorted = [...rows].sort((a, b) => b._avg - a._avg);
  let rank = 1;
  sorted.forEach((row, i) => {
    if (i > 0 && sorted[i - 1]._avg !== row._avg) rank = i + 1;
    row.rank = rank;
  });

  return sorted.map(({ _avg, ...rest }) => rest);
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
      s.studentId === studentId &&
      s.classId === classId &&
      s.mode === mode &&
      s.termKey === termKey
  );
  if (mine.length === 0) return [];
  const weak = mine
    .filter((s) => isWeakGrade(s.grade))
    .map((s) => subjectNames[s.subjectCode] || s.subjectCode);
  if (weak.length === 0 && mine.every((s) => s.totalScore >= 80)) return 'ALL_EXCELLENT';
  return weak;
}
