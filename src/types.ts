export type Programme = 'PRIMARY' | 'SECONDARY';
export type SubjectKind = 'scored' | 'scoreOnly' | 'commentOnly';
export type ReportMode = 'EOT' | 'MIDTERM';
export type TermCode = 'T1' | 'T2' | 'T3';
export type StudentStatus = 'active' | 'alumni' | 'transferred';
export type DeliveryStatus =
  | ''
  | 'PDF_READY'
  | 'MIDTERM_READY'
  | 'SENT'
  | 'INVALID FORMAT'
  | 'UPLOAD FAIL'
  | string;

export interface School {
  id: string;
  name: string;
  address?: string;
  website?: string;
  email?: string;
  tel?: string;
  headteacherId: string;
}

export interface User {
  id: string;
  name: string;
  role: 'headteacher' | 'teacher' | 'student';
  schoolId: string;
  /** For student role: lifelong student UUID */
  linkedStudentId?: string;
  /** For student role: lifelong key (session-bound transcript) */
  studentKey?: string;
}

export interface SubjectAssignment {
  subjectCode: string;
  teacherId: string;
}

export interface ClassSettings {
  termYearInfo: string;
  reportDate: string;
  nextTermBegins: string;
  schoolBreaks: string;
  schoolResumes: string;
  attendanceTotal: number;
  teacherName: string;
  showProjectWork: boolean;
  nameFormat: 'LAST_FIRST' | 'FIRST_LAST';
}

export interface ClassStream {
  id: string;
  name: string;
  schoolId: string;
  programme: Programme;
  teacherId: string;
  subjectTeachers: SubjectAssignment[];
  settings: ClassSettings;
  activeClassId?: string;
}

/** @deprecated alias kept for gradual migration */
export type ClassRoom = ClassStream;

export interface SubjectDefinition {
  code: string;
  name: string;
  kind: SubjectKind;
  abbr: string;
}

/** Lifelong identity — key never encodes class/year */
export interface LifelongStudent {
  id: string;
  studentKey: string;
  name: string;
  gender: 'Male' | 'Female' | 'Unknown';
  schoolId: string;
  yearJoined: number;
  status: StudentStatus;
}

export interface ClassEnrollment {
  id: string;
  studentId: string;
  studentKey: string;
  classId: string;
  academicYear: string;
  className: string;
  programme: Programme;
  rollNumber: string;
  index: string;
  attendance: number;
  enrolledTerms: TermCode[];
  formTeacherId: string;
  subjectTeacherIds: string[];
}

/**
 * Classlist view model (enrollment + lifelong joined).
 * `studentId` here is the operational rollNumber for display.
 * `studentKey` is the lifelong key.
 */
export interface Student {
  id: string;
  studentKey: string;
  studentId: string;
  name: string;
  gender: 'Male' | 'Female' | 'Unknown';
  index: string;
  classId: string;
  schoolId: string;
  attendance: number;
  yearJoined: number;
  status: StudentStatus;
  academicYear?: string;
  enrolledTerms?: TermCode[];
}

export interface SubjectLineSnapshot {
  code: string;
  name: string;
  totalScore: number;
  grade: string;
}

export type MtEntryMode = 'split' | 'single';

export interface AssessmentScore {
  id: string;
  studentId: string;
  classId: string;
  subjectCode: string;
  mode: ReportMode;
  termKey: string;
  academicYear: string;
  /** Raw classwork marks, each out of 10 (blank/null → 0 when scaling). */
  cwRaw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
  ];
  /** Class-wide midterm entry shape forced on save. */
  mtEntryMode?: MtEntryMode;
  /** Raw midterm components out of 30 / 30 / 40 when mtEntryMode === 'split'. */
  mtRawSplit?: [number | null, number | null, number | null];
  /** Raw midterm out of 100 when mtEntryMode === 'single'. */
  mtRawSingle?: number | null;
  /** Raw exam out of 100 (scaled to /60 on the report). */
  examRaw?: number | null;
  /** Scaled classwork contribution /20 (report). */
  cwScore?: number;
  /** Scaled midterm contribution /20 (report). */
  mtScore?: number;
  /** Scaled exam contribution /60 (report). */
  eotScore?: number;
  totalScore: number;
  grade: string;
  comment: string;
  classAverage?: number;
}

/** Legacy alias used by older pages during migration */
export type SubjectResult = AssessmentScore & {
  subjectName?: string;
};

export interface ReportSummary {
  id: string;
  studentId: string;
  classId: string;
  mode: ReportMode;
  termKey: string;
  academicYear: string;
  rawScore: number | null;
  averageScore: number | null;
  aveGrade: string | null;
  bestMark: number | null;
  bestGrade: string | null;
  leastMark: number | null;
  leastGrade: string | null;
  rank: number | null;
  peComment: string;
  clubComment: string;
  generalComment: string;
  teacherName: string;
  className: string;
  programme: Programme;
  finalized: boolean;
  subjectLines: SubjectLineSnapshot[] | null;
}

/** Legacy alias */
export type FinalReport = ReportSummary;

export interface Contact {
  id: string;
  studentId: string;
  classId: string;
  phone: string;
  email: string;
  pdfId: string;
  midtermPdfId: string;
  whatsappStatus: DeliveryStatus;
  emailStatus: DeliveryStatus;
}

export interface SubjectContext {
  classId: string;
  subjectCode: string;
  gradeBand: string;
  topics: string[];
}

export interface BannedTokenLedger {
  studentId: string;
  classId: string;
  termKey: string;
  tokens: string[];
}

export const DEFAULT_CLASS_SETTINGS = (): ClassSettings => ({
  termYearInfo: '2025/2026 — Term 3',
  reportDate: '',
  nextTermBegins: '',
  schoolBreaks: '',
  schoolResumes: '',
  attendanceTotal: 64,
  teacherName: '',
  showProjectWork: true,
  nameFormat: 'LAST_FIRST',
});
