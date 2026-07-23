import type {
  AssessmentScore,
  BannedTokenLedger,
  ClassEnrollment,
  ClassStream,
  Contact,
  LifelongStudent,
  ReportSummary,
  School,
  SubjectContext,
  User,
} from '../types';

/** Full flat snapshot — each field is a Firestore-like collection */
export type SaisSnapshot = {
  schools: School[];
  users: User[];
  classes: ClassStream[];
  lifelongStudents: LifelongStudent[];
  enrollments: ClassEnrollment[];
  scores: AssessmentScore[];
  summaries: ReportSummary[];
  contacts: Contact[];
  subjectContexts: SubjectContext[];
  bannedTokens: BannedTokenLedger[];
  activeClassId: string | null;
  keySeq: Record<string, number>;
};

export type SnapshotCollection = keyof SaisSnapshot;

/**
 * Async repository contract.
 * LocalStorageRepository fakes network latency on reads so UI learns loading states.
 * FirestoreRepository (later) implements the same surface — React pages stay unchanged.
 */
export interface DatabaseRepository {
  loadAll(): Promise<SaisSnapshot>;
  saveCollection<K extends SnapshotCollection>(
    key: K,
    value: SaisSnapshot[K]
  ): Promise<void>;
  replaceAll(snapshot: SaisSnapshot): Promise<void>;
  clearAll(): Promise<void>;

  getLifelongStudents(): Promise<LifelongStudent[]>;
  getEnrollmentsByStudentKey(studentKey: string): Promise<ClassEnrollment[]>;
  getSummariesByStudentId(studentId: string): Promise<ReportSummary[]>;
  upsertSummary(summary: ReportSummary): Promise<void>;
}

export const EMPTY_SNAPSHOT: SaisSnapshot = {
  schools: [],
  users: [],
  classes: [],
  lifelongStudents: [],
  enrollments: [],
  scores: [],
  summaries: [],
  contacts: [],
  subjectContexts: [],
  bannedTokens: [],
  activeClassId: null,
  keySeq: {},
};
