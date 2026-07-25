import { academicYearLabel, buildTermKey, termNumberFromCode } from './academicYear';
import type {
  ClassEnrollment,
  LifelongStudent,
  ReportSummary,
  SubjectLineSnapshot,
  TermCode,
  Student,
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
      const termKey = buildTermKey(en.academicYear, termCode);
      const termNum = termNumberFromCode(termCode);

      const summary = source.summaries.find(
        (s) =>
          (s.studentId === en.studentId || s.studentId === student.id || s.studentId === en.rollNumber) &&
          (s.academicYear === en.academicYear || s.termKey.includes(en.academicYear.replace('/', '_'))) &&
          s.termKey === termKey &&
          s.mode === 'EOT'
      );

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
        averageScore: summary?.averageScore ?? null,
        aveGrade: summary?.aveGrade ?? null,
        rank: summary?.rank ?? null,
        finalized: summary?.finalized ?? false,
        subjectLines: summary?.subjectLines ?? [],
        generalComment: summary?.generalComment || '',
        peComment: summary?.peComment || '',
        clubComment: summary?.clubComment || '',
        teacherName: summary?.teacherName || '',
      });
    }
  }

  // Calculate Cumulative Performance Stats
  const completedBlocks = blocks.filter((b) => b.averageScore !== null && b.averageScore > 0);
  const totalTermsCompleted = completedBlocks.length;
  const sumAverage = completedBlocks.reduce((sum, b) => sum + (b.averageScore || 0), 0);
  const cumulativeAverage = totalTermsCompleted > 0 ? Number((sumAverage / totalTermsCompleted).toFixed(2)) : 0;

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
