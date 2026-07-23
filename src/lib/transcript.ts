import { academicYearLabel, buildTermKey, termNumberFromCode } from './academicYear';
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
      (l) => !scope.schoolId || l.schoolId === scope.schoolId
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
        l.studentKey.toUpperCase().includes(q)
    )
    .map((l) => {
      const ens = source.enrollments
        .filter((e) => e.studentKey === l.studentKey)
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
  return source.lifelongStudents.find((l) => l.studentKey === studentKey) ?? null;
}

export async function buildTranscript(
  studentKey: string,
  source: TranscriptDataSource
): Promise<TranscriptDocumentModel | null> {
  const student = await getStudentByKey(studentKey, source);
  if (!student) return null;

  const ens = source.enrollments
    .filter((e) => e.studentKey === studentKey)
    .sort((a, b) => {
      const y = a.academicYear.localeCompare(b.academicYear);
      if (y !== 0) return y;
      return a.className.localeCompare(b.className);
    });

  const blocks: TranscriptTermBlock[] = [];

  for (const en of ens) {
    const terms = [...en.enrolledTerms].sort(
      (a, b) => termNumberFromCode(a) - termNumberFromCode(b)
    );
    for (const termCode of terms) {
      const termKey = buildTermKey(en.academicYear, termCode);
      const summary = source.summaries.find(
        (s) =>
          s.studentId === en.studentId &&
          s.academicYear === en.academicYear &&
          s.termKey === termKey &&
          s.mode === 'EOT'
      );

      if (summary?.finalized && summary.subjectLines) {
        blocks.push({
          kind: 'finalized',
          academicYear: en.academicYear,
          termCode,
          termKey,
          className: summary.className || en.className,
          programme: summary.programme || en.programme,
          rollNumber: en.rollNumber,
          averageScore: summary.averageScore,
          aveGrade: summary.aveGrade,
          rank: summary.rank,
          subjectLines: summary.subjectLines,
          generalComment: summary.generalComment,
          teacherName: summary.teacherName,
        });
      } else {
        blocks.push({
          kind: 'missing',
          academicYear: en.academicYear,
          termCode,
          termKey,
          className: en.className,
          programme: en.programme,
          rollNumber: en.rollNumber,
        });
      }
    }
  }

  return { student, blocks };
}

export function termHeading(academicYear: string, termCode: TermCode): string {
  return `${academicYearLabel(academicYear)} — Term ${termNumberFromCode(termCode)}`;
}

/** Teacher/HT may only open a key if it is in their search scope */
export async function assertTranscriptAccess(
  studentKey: string,
  source: TranscriptDataSource,
  scope: { role: User['role']; userId: string; schoolId?: string }
): Promise<boolean> {
  if (scope.role === 'student') return false;
  const hits = await searchStudentsByName(studentKey, source, scope);
  return hits.some((h) => h.studentKey === studentKey);
}
