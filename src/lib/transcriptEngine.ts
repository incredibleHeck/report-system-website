import { academicYearLabel, buildTermKey, termNumberFromCode, toCanonicalTermKey, parseTermKey } from './academicYear';
import { getSubjectByCode } from './programmeSchemas';
import { gradeFromTotal } from './grading';
import type {
  ClassEnrollment,
  LifelongStudent,
  ReportSummary,
  SubjectLineSnapshot,
  TermCode,
  Student,
  AssessmentScore,
} from '../types';

export interface MultiYearTermBlock {
  academicYear: string;
  termCode: TermCode;
  termKey: string;
  termNumber: number;
  className: string;
  programme: string;
  rollNumber: string;
  index: string;
  attendance: number;
  averageScore: number | null;
  aveGrade: string | null;
  rank: number | null;
  finalized: boolean;
  subjectLines: SubjectLineSnapshot[];
  generalComment: string;
  peComment: string;
  clubComment: string;
  teacherName: string;
}

export interface MultiYearTranscriptResult {
  student: LifelongStudent;
  primaryRollNumber: string;
  recentClassName: string;
  blocks: MultiYearTermBlock[];
  cumulativeAverage: number;
  cumulativeGrade: string;
  totalTermsCompleted: number;
  totalAttendanceDays: number;
}

export interface TranscriptEngineDataSource {
  lifelongStudents: LifelongStudent[];
  enrollments: ClassEnrollment[];
  summaries: ReportSummary[];
  scores?: AssessmentScore[];
  students?: Student[];
}

/**
 * Flexible student lookup matching studentKey, studentUid (id), studentId (rollNumber), or indexNo.
 */
export function findStudentByAnyIdentifier(
  identifier: string,
  source: TranscriptEngineDataSource
): LifelongStudent | null {
  const query = identifier.trim().toUpperCase();
  if (!query) return null;

  // 1. Direct match by studentKey
  const byKey = source.lifelongStudents.find((l) => l.studentKey.toUpperCase() === query);
  if (byKey) return byKey;

  // 2. Direct match by Lifelong ID
  const byId = source.lifelongStudents.find((l) => l.id.toUpperCase() === query);
  if (byId) return byId;

  // 3. Match via Enrollment rollNumber (studentId) or index
  const enrollmentMatch = source.enrollments.find(
    (en) => en.rollNumber.toUpperCase() === query || en.studentId.toUpperCase() === query || en.index === query
  );
  if (enrollmentMatch) {
    const fromEnr = source.lifelongStudents.find((l) => l.studentKey === enrollmentMatch.studentKey);
    if (fromEnr) return fromEnr;
  }

  // 4. Case-insensitive substring match on name
  const byName = source.lifelongStudents.find((l) => l.name.toUpperCase().includes(query));
  return byName || null;
}

/**
 * Builds a complete multi-year chronological transcript across all past, present, and upcoming academic years.
 */
export function buildMultiYearTranscript(
  identifier: string,
  source: TranscriptEngineDataSource
): MultiYearTranscriptResult | null {
  const student = findStudentByAnyIdentifier(identifier, source);
  if (!student) return null;

  // Gather all enrollments for this student across all academic years
  const studentEnrollments = source.enrollments
    .filter((e) => e.studentKey === student.studentKey || e.studentId === student.id)
    .sort((a, b) => a.academicYear.localeCompare(b.academicYear));

  const blocks: MultiYearTermBlock[] = [];

  // Iterate chronologically through all enrollments and their terms
  for (const en of studentEnrollments) {
    const termCodes: TermCode[] = [...(en.enrolledTerms || ['T1', 'T2', 'T3'])].sort(
      (a, b) => termNumberFromCode(a) - termNumberFromCode(b)
    );

    for (const termCode of termCodes) {
      const termKey = toCanonicalTermKey(en.academicYear, termCode);
      const termNum = termNumberFromCode(termCode);

      const summary = source.summaries.find((s) => {
        const matchesStudent = s.studentId === en.studentId || s.studentId === student.id || s.studentId === en.rollNumber;
        if (!matchesStudent || s.mode !== 'EOT') return false;
        
        // Use parseTermKey to extract the actual year/term from the summary's termKey, 
        // then normalize it to compare against our generated canonical termKey.
        const parsed = parseTermKey(s.termKey);
        const sCanonical = toCanonicalTermKey(s.academicYear || parsed.academicYear, parsed.termCode || 'T1');
        return sCanonical === termKey;
      });

      // Build subjectLines from summary if present, otherwise fallback to source.scores
      let rawSubjectLines: SubjectLineSnapshot[] = summary?.subjectLines && summary.subjectLines.length > 0
        ? summary.subjectLines
        : [];

      if (rawSubjectLines.length === 0 && source.scores && source.scores.length > 0) {
        const studentScores = source.scores.filter((sc) => {
          const matchStudent =
            sc.studentId === en.studentId ||
            sc.studentId === student.id ||
            sc.studentId === en.rollNumber ||
            sc.studentId === student.studentKey;
          if (!matchStudent || sc.mode !== 'EOT') return false;
          const parsed = parseTermKey(sc.termKey);
          const scCanonical = toCanonicalTermKey(sc.academicYear || parsed.academicYear, parsed.termCode || 'T1');
          return scCanonical === termKey;
        });

        rawSubjectLines = studentScores
          .filter((sc) => sc.totalScore !== null && sc.totalScore !== undefined)
          .map((sc) => {
            const prog = (en.programme || 'PRIMARY') as any;
            const subDef = getSubjectByCode(prog, sc.subjectCode);
            const tot = sc.totalScore ?? 0;
            return {
              code: sc.subjectCode,
              name: subDef?.name || sc.subjectCode,
              totalScore: tot,
              grade: typeof sc.grade === 'string' && sc.grade ? sc.grade : gradeFromTotal(tot).grade,
            };
          });
      }

      const subjectLines = rawSubjectLines.filter((l) => l.code !== 'MUSIC' && l.code !== 'PROJ');

      const calcAvg = subjectLines.length > 0
        ? Number((subjectLines.reduce((acc, l) => acc + l.totalScore, 0) / subjectLines.length).toFixed(2))
        : null;

      const averageScore = summary?.averageScore ?? calcAvg;
      const aveGrade = summary?.aveGrade ?? (calcAvg !== null ? gradeFromTotal(calcAvg).grade : null);

      blocks.push({
        academicYear: en.academicYear,
        termCode,
        termKey,
        termNumber: termNum,
        className: summary?.className || en.className,
        programme: summary?.programme || en.programme,
        rollNumber: en.rollNumber,
        index: en.index,
        attendance: en.attendance ?? 60,
        averageScore,
        aveGrade,
        rank: summary?.rank ?? null,
        finalized: summary?.finalized ?? (subjectLines.length > 0),
        subjectLines,
        generalComment: summary?.generalComment || '',
        peComment: summary?.peComment || '',
        clubComment: summary?.clubComment || '',
        teacherName: summary?.teacherName || '',
      });
    }
  }

  // Calculate Cumulative Performance Stats (Weighted by subjects)
  const completedBlocks = blocks.filter((b) => b.averageScore !== null && b.averageScore > 0);
  const totalTermsCompleted = completedBlocks.length;
  
  let totalScoreSum = 0;
  let totalSubjectsCount = 0;
  
  for (const b of completedBlocks) {
    const numSubs = b.subjectLines?.length || 0;
    if (numSubs > 0 && b.averageScore !== null) {
      totalScoreSum += (b.averageScore * numSubs);
      totalSubjectsCount += numSubs;
    }
  }
  
  const cumulativeAverage = totalSubjectsCount > 0 ? Number((totalScoreSum / totalSubjectsCount).toFixed(2)) : 0;

  let cumulativeGrade = 'U';
  if (cumulativeAverage >= 90) cumulativeGrade = 'A*';
  else if (cumulativeAverage >= 80) cumulativeGrade = 'A';
  else if (cumulativeAverage >= 70) cumulativeGrade = 'B';
  else if (cumulativeAverage >= 60) cumulativeGrade = 'C';
  else if (cumulativeAverage >= 50) cumulativeGrade = 'D';
  else if (cumulativeAverage >= 40) cumulativeGrade = 'E';

  const totalAttendanceDays = blocks.reduce((sum, b) => sum + (b.attendance || 0), 0);
  const primaryRollNumber = studentEnrollments[0]?.rollNumber || student.studentKey;
  const recentClassName = studentEnrollments[studentEnrollments.length - 1]?.className || 'Unassigned';

  return {
    student,
    primaryRollNumber,
    recentClassName,
    blocks,
    cumulativeAverage,
    cumulativeGrade,
    totalTermsCompleted,
    totalAttendanceDays,
  };
}
