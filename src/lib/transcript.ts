import { academicYearLabel, buildTermKey, termNumberFromCode } from './academicYear';
import { findStudentByAnyIdentifier, buildMultiYearTranscript } from './transcriptEngine';
import type {
  ClassEnrollment,
  LifelongStudent,
  ReportSummary,
  SubjectLineSnapshot,
  TermCode,
  User,
} from '../types';

export type TranscriptSearchHit = {
  studentKey: string;
  name: string;
  status: LifelongStudent['status'];
  yearJoined: number;
  recentClassName?: string;
};

export type TranscriptTermBlock =
  | {
      kind: 'finalized';
      academicYear: string;
      termCode: TermCode;
      termKey: string;
      className: string;
      programme: string;
      rollNumber: string;
      averageScore: number | null;
      aveGrade: string | null;
      rank: number | null;
      subjectLines: SubjectLineSnapshot[];
      generalComment: string;
      teacherName: string;
    }
  | {
      kind: 'missing';
      academicYear: string;
      termCode: TermCode;
      termKey: string;
      className: string;
      programme: string;
      rollNumber: string;
    };

export type TranscriptDocumentModel = {
  student: LifelongStudent;
  blocks: TranscriptTermBlock[];
  cumulativeAverage: number;
  cumulativeGrade: string;
};

export type TranscriptDataSource = {
  lifelongStudents: LifelongStudent[];
  enrollments: ClassEnrollment[];
  summaries: ReportSummary[];
};

function enrollmentVisibleToTeacher(en: ClassEnrollment, teacherId: string): boolean {
  return (
    en.formTeacherId === teacherId || en.subjectTeacherIds.includes(teacherId)
  );
}

function scopedLifelong(
  source: TranscriptDataSource,
  scope: { role: User['role']; userId: string; schoolId?: string }
): LifelongStudent[] {
  if (scope.role === 'headteacher') {
    return source.lifelongStudents.filter(
      (l) =>
        !scope.schoolId ||
        l.schoolId === scope.schoolId ||
        l.schoolId === 'sais-school-main' ||
        l.schoolId === 'demo-school-id'
    );
  }
  if (scope.role === 'teacher') {
    const keys = new Set(
      source.enrollments
        .filter((en) => enrollmentVisibleToTeacher(en, scope.userId))
        .map((en) => en.studentKey)
    );
    return source.lifelongStudents.filter((l) => keys.has(l.studentKey));
  }
  return [];
}

export async function searchStudentsByName(
  query: string,
  source: TranscriptDataSource,
  scope: { role: User['role']; userId: string; schoolId?: string }
): Promise<TranscriptSearchHit[]> {
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];

  const pool = scopedLifelong(source, scope);
  const hits = pool
    .filter(
      (l) =>
        l.name.toUpperCase().includes(q) ||
        l.studentKey.toUpperCase().includes(q) ||
        l.id.toUpperCase().includes(q)
    )
    .map((l) => {
      const ens = source.enrollments
        .filter((e) => e.studentKey === l.studentKey || e.studentId === l.id)
        .sort((a, b) => b.academicYear.localeCompare(a.academicYear));
      return {
        studentKey: l.studentKey,
        name: l.name,
        status: l.status,
        yearJoined: l.yearJoined,
        recentClassName: ens[0]?.className,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return hits;
}

export async function getStudentByKey(
  studentKey: string,
  source: TranscriptDataSource
): Promise<LifelongStudent | null> {
  return findStudentByAnyIdentifier(studentKey, source);
}

export async function buildTranscript(
  studentKey: string,
  source: TranscriptDataSource
): Promise<TranscriptDocumentModel | null> {
  const multiYear = buildMultiYearTranscript(studentKey, source);
  if (!multiYear) return null;

  const blocks: TranscriptTermBlock[] = multiYear.blocks.map((b) => {
    const hasLines = Boolean(b.subjectLines && b.subjectLines.length > 0);
    if (hasLines || b.finalized || (b.averageScore !== null && b.averageScore > 0)) {
      return {
        kind: 'finalized',
        academicYear: b.academicYear,
        termCode: b.termCode,
        termKey: b.termKey,
        className: b.className,
        programme: b.programme,
        rollNumber: b.rollNumber,
        averageScore: b.averageScore,
        aveGrade: b.aveGrade,
        rank: b.rank,
        subjectLines: b.subjectLines,
        generalComment: b.generalComment,
        teacherName: b.teacherName,
      };
    }
    return {
      kind: 'missing',
      academicYear: b.academicYear,
      termCode: b.termCode,
      termKey: b.termKey,
      className: b.className,
      programme: b.programme,
      rollNumber: b.rollNumber,
    };
  });

  return { 
    student: multiYear.student, 
    blocks,
    cumulativeAverage: multiYear.cumulativeAverage,
    cumulativeGrade: multiYear.cumulativeGrade,
  };
}

export function termHeading(academicYear: string, termCode: TermCode): string {
  return `${academicYearLabel(academicYear)} — Term ${termNumberFromCode(termCode)}`;
}

/** Teacher/HT may only open a key if it is in their search scope */
export async function assertTranscriptAccess(
  studentKey: string,
  source: TranscriptDataSource,
  scope: { role: User['role'] | 'student'; userId: string; schoolId?: string }
): Promise<boolean> {
  if (scope.role === 'student') return false;
  const hits = await searchStudentsByName(
    studentKey,
    source,
    scope as { role: User['role']; userId: string; schoolId?: string }
  );
  return hits.some((h) => h.studentKey === studentKey);
}

export { buildMultiYearTranscript, findStudentByAnyIdentifier } from './transcriptEngine';
