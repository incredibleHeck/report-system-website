import type { Programme } from './class.types';
import type { CanonicalTermKey } from '../lib/academicYear';

export type ReportMode = 'EOT' | 'MIDTERM';

export type DeliveryStatus =
  | ''
  | 'PDF_READY'
  | 'MIDTERM_READY'
  | 'SENT'
  | 'INVALID FORMAT'
  | 'UPLOAD FAIL'
  | string;

export interface SubjectLineSnapshot {
  code: string;
  name: string;
  totalScore: number;
  grade: string;
}

export type MtEntryMode = 'split' | 'single';

export interface SubjectMark {
  id?: string;
  studentId: string;
  classId: string;
  subjectCode: string;
  clubName?: string;
  mode?: ReportMode;
  termKey?: CanonicalTermKey | string;
  academicYear?: string;
  cw1?: number | null;
  cw2?: number | null;
  cw3?: number | null;
  cw4?: number | null;
  cw5?: number | null;
  cwTotal?: number;
  cwScaled?: number;
  mt1?: number | null;
  mt2?: number | null;
  mt3?: number | null;
  mtSingle?: number | null;
  mtRaw?: number;
  mtScaled?: number;
  exam?: number | null;
  examScaled?: number;
  totalScore: number;
  grade: string;
  comment?: string;
}

export interface AssessmentScore {
  id: string;
  studentId: string;
  classId: string;
  subjectCode: string;
  clubName?: string;
  mode: ReportMode;
  termKey: CanonicalTermKey | string;
  academicYear: string;
  /** Individual CW slots 1..5 out of 10 */
  cw1?: number | null;
  cw2?: number | null;
  cw3?: number | null;
  cw4?: number | null;
  cw5?: number | null;
  cwTotal?: number;
  cwScaled?: number;
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
  mt1?: number | null;
  mt2?: number | null;
  mt3?: number | null;
  mtSingle?: number | null;
  mtRaw?: number;
  mtScaled?: number;
  /** Raw midterm components out of 30 / 30 / 40 when mtEntryMode === 'split'. */
  mtRawSplit?: [number | null, number | null, number | null];
  /** Raw midterm out of 100 when mtEntryMode === 'single'. */
  mtRawSingle?: number | null;
  /** Raw exam out of 100 (scaled to /60 on the report). */
  examRaw?: number | null;
  examScaled?: number;
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
  clubName?: string;
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
  isFinalized?: boolean;
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

export interface BannedTokenLedger {
  studentId: string;
  classId: string;
  termKey: string;
  tokens: string[];
}
