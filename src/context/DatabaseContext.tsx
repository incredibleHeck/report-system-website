import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { 
  type School, type User, type ClassStream, type ClassEnrollment, type Student,
  type LifelongStudent, type AssessmentScore, type ReportSummary, type Contact,
  type SubjectContext, type BannedTokenLedger,
  type ClassSettings,
  DEFAULT_CLASS_SETTINGS,
  type Programme,
  type ReportMode,
  type TermCode,
  type SubjectLineSnapshot,
} from '../types';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  parseAcademicYear,
  buildTermKey,
  formatStudentKey,
  yearStartFromAcademicYear,
  termsFromJoin,
  termsThroughLast,
  ALL_TERMS,
  parseTermKey,
} from '../lib/academicYear';
import { detectTermNumber } from '../lib/term';
import { KEYS, createId, localRepository, type SaisSnapshot } from '../data';
import { FirestoreRepository } from '../data/FirestoreRepository';
import { ensureBaselineAcademicYears, createAcademicYearWith3Terms } from '../lib/academicYearInit';

const activeRepository = import.meta.env.VITE_DATA_BACKEND === 'firestore' && import.meta.env.VITE_FIREBASE_API_KEY
  ? new FirestoreRepository()
  : localRepository;
export const normalizeYearId = (id?: string) => (id ? id.replace('/', '-').trim() : '');

export const getStreamYearId = (cs: ClassStream): string => {
  if (cs.academicYearId) return normalizeYearId(cs.academicYearId);
  if (cs.academicYear) return normalizeYearId(cs.academicYear);
  const parts = cs.id.split('-');
  if (parts.length >= 2 && /^\d{4}$/.test(parts[0]) && /^\d{4}$/.test(parts[1])) {
    return `${parts[0]}-${parts[1]}`;
  }
  if (cs.settings?.termYearInfo) {
    const y = cs.settings.termYearInfo.split(' — ')[0] || cs.settings.termYearInfo.split(' - ')[0];
    if (y) return normalizeYearId(y);
  }
  return '2026-2027';
};

interface DatabaseContextType {
  /** False until async repository hydrate finishes (simulates Firestore load). */
  dbReady: boolean;
  dbLoading: boolean;
  schools: School[];
  users: User[];
  classes: ClassStream[];
  lifelongStudents: LifelongStudent[];
  enrollments: ClassEnrollment[];
  students: Student[];
  scores: AssessmentScore[];
  summaries: ReportSummary[];
  contacts: Contact[];
  subjectContexts: SubjectContext[];
  bannedTokens: BannedTokenLedger[];
  activeClassId: string | null;
  setActiveClassId: (id: string | null) => void;
  selectedAcademicYearId: string;
  setSelectedAcademicYearId: (yearId: string) => void;
  filteredClassStreams: ClassStream[];
  availableStreams: ClassStream[];

  registerSchool: (school: Omit<School, 'id'>) => string;
  updateSchool: (id: string, patch: Partial<School>) => void;
  addTeacher: (teacher: Omit<User, 'id' | 'role'>) => string;
  updateUser: (id: string, patch: Partial<User>) => void;
  createClass: (input: {
    name: string;
    schoolId: string;
    programme: Programme;
    teacherId: string;
    settings?: Partial<ClassSettings>;
  }) => string;
  updateClassSettings: (classId: string, settings: Partial<ClassSettings>) => void;
  assignSubjectTeacher: (classId: string, subjectCode: string, teacherId: string) => void;
  setFormTeacher: (classId: string, teacherId: string) => void;
  addStudent: (
    student: Omit<Student, 'id' | 'studentKey' | 'yearJoined' | 'status'> & {
      enrolledTerms?: TermCode[];
      yearJoined?: number;
    }
  ) => string;
  enrollExistingStudent: (input: {
    studentKey?: string;
    studentId?: string;
    classId: string;
    rollNumber: string;
    index: string;
    enrolledTerms?: TermCode[];
    attendance?: number;
  }) => string;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  transferStudent: (studentId: string, lastTerm: TermCode) => void;
  upsertScore: (score: Omit<AssessmentScore, 'id'>) => void;
  upsertScores: (scores: Omit<AssessmentScore, 'id'>[]) => void;
  replaceScores: (scores: AssessmentScore[]) => void;
  replaceSummaries: (reports: ReportSummary[]) => void;
  saveSummaries: (reports: Omit<ReportSummary, 'id'>[]) => void;
  finalizeReports: (reports: Omit<ReportSummary, 'id'>[]) => void;
  unfinalizeReport: (
    studentId: string,
    academicYear: string,
    termKey: string,
    mode?: ReportMode
  ) => void;
  upsertContact: (contact: Omit<Contact, 'id'> & { id?: string }) => void;
  updateContactStatus: (
    studentId: string,
    classId: string,
    patch: Partial<
      Pick<Contact, 'pdfId' | 'midtermPdfId' | 'whatsappStatus' | 'emailStatus' | 'phone' | 'email'>
    >
  ) => void;
  saveSubjectContext: (ctx: SubjectContext) => void;
  mergeBannedTokens: (studentId: string, classId: string, termKey: string, tokens: string[]) => void;
  createAcademicYear: (
    academicYear: string,
    status?: 'active' | 'upcoming'
  ) => Promise<string>;
  seedDemoData: () => void;
  clearAllData: () => void;

  results: AssessmentScore[];
  finalReports: ReportSummary[];
  saveSubjectResults: (result: Omit<AssessmentScore, 'id'> & { subjectName?: string }) => void;
  saveFinalReports: (reports: Omit<ReportSummary, 'id'>[]) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

function scoreKey(s: Pick<AssessmentScore, 'studentId' | 'subjectCode' | 'mode' | 'termKey'>) {
  return `${s.studentId}|${s.subjectCode}|${s.mode}|${s.termKey}`;
}

function summaryKey(
  r: Pick<ReportSummary, 'studentId' | 'academicYear' | 'termKey' | 'mode'>
) {
  return `${r.studentId}|${r.academicYear}|${r.termKey}|${r.mode}`;
}

function toStudentView(life: LifelongStudent, en: ClassEnrollment): Student {
  return {
    id: life.id,
    studentKey: life.studentKey,
    studentId: en.rollNumber,
    name: life.name,
    gender: life.gender,
    index: en.index,
    classId: en.classId,
    schoolId: life.schoolId,
    attendance: en.attendance,
    yearJoined: life.yearJoined,
    status: life.status,
    academicYear: en.academicYear,
    enrolledTerms: en.enrolledTerms,
  };
}

function normalizeTermFields<T extends { termKey: string; academicYear?: string }>(
  item: T
): T {
  const parsed = parseTermKey(item.termKey);
  const termCode = parsed.termCode ?? 'T3';
  return {
    ...item,
    academicYear: item.academicYear || parsed.academicYear,
    termKey: buildTermKey(item.academicYear || parsed.academicYear, termCode),
  };
}

function enrollmentFromClass(
  cls: ClassStream,
  base: Pick<
    ClassEnrollment,
    'studentId' | 'studentKey' | 'classId' | 'rollNumber' | 'index' | 'attendance' | 'enrolledTerms'
  > & { id?: string; academicYear?: string }
): ClassEnrollment {
  const academicYear = base.academicYear ?? parseAcademicYear(cls.settings.termYearInfo);
  return {
    ...base,
    id: base.id ?? createId(),
    academicYear,
    className: cls.name,
    programme: cls.programme,
    formTeacherId: cls.teacherId,
    subjectTeacherIds: (cls.subjectTeachers ?? []).map((st) => st.teacherId),
  };
}

export function deduplicateUsersByEmail(userList: User[]): User[] {
  const map = new Map<string, User>();
  for (const u of userList) {
    const emailKey = (u.email || '').trim().toLowerCase();
    const key = emailKey || u.id;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, u);
    } else {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...u,
        name: (u.name && u.name.trim() !== '') ? u.name : existing.name,
        subjects: (u.subjects && u.subjects.length > 0) ? u.subjects : existing.subjects,
        role: u.role || existing.role,
        schoolId: u.schoolId || existing.schoolId,
      });
    }
  }
  return Array.from(map.values());
}

function applyLegacyMigration(snap: SaisSnapshot): SaisSnapshot {
  let seq = { ...snap.keySeq };
  let lifelongStudents = [...snap.lifelongStudents];
  let enrollments = [...snap.enrollments];
  let scores = snap.scores.map(normalizeTermFields);
  let summaries = snap.summaries.map(normalizeTermFields);

  type LegacyStudent = {
    id: string;
    studentId: string;
    name: string;
    gender: 'Male' | 'Female' | 'Unknown';
    index: string;
    classId: string;
    schoolId: string;
    attendance: number;
    studentKey?: string;
    yearJoined?: number;
    status?: LifelongStudent['status'];
  };

  let legacyStudents: LegacyStudent[] = [];
  try {
    const raw = localStorage.getItem(KEYS.legacyStudents);
    legacyStudents = raw ? (JSON.parse(raw) as LegacyStudent[]) : [];
  } catch {
    legacyStudents = [];
  }

  const activeYear =
    snap.classes.length > 0
      ? parseAcademicYear(snap.classes[0].settings.termYearInfo)
      : '2025_2026';

  if (legacyStudents.length > 0 && lifelongStudents.length === 0) {
    for (const old of legacyStudents) {
      const cls = snap.classes.find((c) => c.id === old.classId);
      const yearJoined =
        old.yearJoined ??
        (cls ? yearStartFromAcademicYear(parseAcademicYear(cls.settings.termYearInfo)) : 2025);
      let studentKey = old.studentKey;
      if (!studentKey) {
        const minted = mintStudentKey(yearJoined, seq);
        studentKey = minted.studentKey;
        seq = minted.seq;
      }
      const lifeId = old.id;
      if (!lifelongStudents.some((l) => l.studentKey === studentKey)) {
        lifelongStudents.push({
          id: lifeId,
          studentKey,
          name: old.name,
          gender: old.gender,
          schoolId: old.schoolId,
          yearJoined,
          status: old.status ?? 'active',
        });
      }
      const academicYear = cls
        ? parseAcademicYear(cls.settings.termYearInfo, activeYear)
        : activeYear;
      if (
        !enrollments.some(
          (e) => e.studentKey === studentKey && e.academicYear === academicYear
        )
      ) {
        enrollments.push(
          cls
            ? enrollmentFromClass(cls, {
                id: createId(),
                studentId: lifeId,
                studentKey,
                classId: old.classId,
                rollNumber: old.studentId,
                index: old.index,
                attendance: old.attendance,
                enrolledTerms: ALL_TERMS,
                academicYear,
              })
            : {
                id: createId(),
                studentId: lifeId,
                studentKey,
                classId: old.classId,
                academicYear,
                className: '',
                programme: 'PRIMARY',
                rollNumber: old.studentId,
                index: old.index,
                attendance: old.attendance,
                enrolledTerms: ALL_TERMS,
                formTeacherId: '',
                subjectTeacherIds: [],
              }
        );
      }
    }
    localStorage.removeItem(KEYS.legacyStudents);
  }

  return {
    ...snap,
    lifelongStudents,
    enrollments,
    scores,
    summaries,
    keySeq: seq,
  };
}

function mintStudentKey(
  yearJoined: number,
  keySeq: Record<string, number>
): { studentKey: string; seq: Record<string, number> } {
  const year = String(yearJoined);
  const next = (keySeq[year] ?? 0) + 1;
  return {
    studentKey: formatStudentKey(yearJoined, next),
    seq: { ...keySeq, [year]: next },
  };
}

function gradeFromTotal(total: number): string {
  if (total >= 90) return 'A*';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  if (total >= 40) return 'E';
  return 'U';
}

function demoSubjectLines(codes: { code: string; name: string; total: number }[]): SubjectLineSnapshot[] {
  return codes.map(({ code, name, total }) => ({
    code,
    name,
    totalScore: total,
    grade: gradeFromTotal(total),
  }));
}

function buildDemoSnapshot(): {
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
  activeClassId: string;
  keySeq: Record<string, number>;
} {
  const schoolId = 'demo-school-id';
  const htId = 'demo-headteacher-id';
  const tPrimary = 'demo-teacher-primary';
  const tSecondary = 'demo-teacher-secondary';
  const primaryClassId = 'demo-primary-class';
  const secondaryClassId = 'demo-secondary-class';
  const y4ClassId = 'demo-y4';

  const settings2526 = {
    ...DEFAULT_CLASS_SETTINGS(),
    teacherName: 'Akosua Mensah',
    termYearInfo: '2025/2026 — Term 3',
    reportDate: '25 July 2026',
    nextTermBegins: '8 September 2026',
  };

  const schools: School[] = [
    {
      id: schoolId,
      name: 'St. Adelaide International Schools',
      address: 'P. O. Box DS 75, Dansoman – Accra',
      website: 'www.saintadelaideschools.org',
      email: 'info@saintadelaideschools.org, st.adelaideschools@gmail.com',
      tel: '020 798 8167 / 027 064 0112 / 024 597 0186',
      headteacherId: htId,
    },
  ];

  const users: User[] = [
    { id: htId, name: 'Demo Headteacher', role: 'headteacher', schoolId },
    { id: tPrimary, name: 'Akosua Mensah', role: 'teacher', schoolId },
    { id: tSecondary, name: 'Kwame Asante', role: 'teacher', schoolId },
  ];

  const classes: ClassStream[] = [
    {
      id: '2026-2027-YEAR-5A',
      name: 'YEAR FIVE (A)',
      schoolId,
      programme: 'PRIMARY',
      teacherId: tPrimary,
      academicYearId: '2026-2027',
      academicYear: '2026/2027',
      subjectTeachers: [
        { subjectCode: 'ENG', teacherId: tPrimary },
        { subjectCode: 'MATH', teacherId: tPrimary },
        { subjectCode: 'SCI', teacherId: tPrimary },
      ],
      settings: {
        ...DEFAULT_CLASS_SETTINGS(),
        teacherName: 'MR. HECTOR ARYIKU',
        termYearInfo: '2026/2027 — Term 1',
        reportDate: '15 December 2026',
        nextTermBegins: '10 January 2027',
      },
    },
    {
      id: primaryClassId,
      name: 'YEAR FIVE (A)',
      schoolId,
      programme: 'PRIMARY',
      teacherId: tPrimary,
      academicYearId: '2025-2026',
      academicYear: '2025/2026',
      subjectTeachers: [
        { subjectCode: 'ENG', teacherId: tPrimary },
        { subjectCode: 'MATH', teacherId: tPrimary },
        { subjectCode: 'SCI', teacherId: tPrimary },
      ],
      settings: settings2526,
    },
    {
      id: secondaryClassId,
      name: 'YEAR NINE (A)',
      schoolId,
      programme: 'LOWER_SECONDARY',
      teacherId: tSecondary,
      academicYearId: '2025-2026',
      academicYear: '2025/2026',
      subjectTeachers: [
        { subjectCode: 'ENG', teacherId: tSecondary },
        { subjectCode: 'MATH', teacherId: tSecondary },
        { subjectCode: 'BIO', teacherId: tSecondary },
      ],
      settings: {
        ...DEFAULT_CLASS_SETTINGS(),
        teacherName: 'Kwame Asante',
        termYearInfo: '2025/2026 — Term 3',
        reportDate: '25 July 2026',
        nextTermBegins: '8 September 2026',
      },
    },
    {
      id: y4ClassId,
      name: 'YEAR FOUR (B)',
      schoolId,
      programme: 'PRIMARY',
      teacherId: tPrimary,
      academicYearId: '2023-2024',
      academicYear: '2023/2024',
      subjectTeachers: [{ subjectCode: 'ENG', teacherId: tPrimary }],
      settings: {
        ...DEFAULT_CLASS_SETTINGS(),
        teacherName: 'Akosua Mensah',
        termYearInfo: '2023/2024 — Term 3',
      },
    },
  ];

  const lifeBoateng: LifelongStudent = {
    id: 'life-boateng',
    studentKey: 'SAIS-2023-0042',
    name: 'BOATENG AMA',
    gender: 'Female',
    schoolId,
    yearJoined: 2023,
    status: 'active',
  };

  const lifeAdjei: LifelongStudent = {
    id: 'life-adjei',
    studentKey: 'SAIS-2025-0001',
    name: 'ADJEI KOFI',
    gender: 'Male',
    schoolId,
    yearJoined: 2025,
    status: 'active',
  };

  const lifeOwusu: LifelongStudent = {
    id: 'life-owusu',
    studentKey: 'SAIS-2025-0003',
    name: 'OWUSU YAW',
    gender: 'Male',
    schoolId,
    yearJoined: 2025,
    status: 'active',
  };

  const lifeMidYear: LifelongStudent = {
    id: 'life-midyear',
    studentKey: 'SAIS-2025-0100',
    name: 'ASANTE ESI',
    gender: 'Female',
    schoolId,
    yearJoined: 2025,
    status: 'active',
  };

  const lifeWithdrawn: LifelongStudent = {
    id: 'life-withdrawn',
    studentKey: 'SAIS-2024-0055',
    name: 'QUAYE NII',
    gender: 'Male',
    schoolId,
    yearJoined: 2024,
    status: 'transferred',
  };

  const lifeMensah: LifelongStudent = {
    id: 'life-mensah',
    studentKey: 'SAIS-2025-0020',
    name: 'MENSAH EFUA',
    gender: 'Female',
    schoolId,
    yearJoined: 2025,
    status: 'active',
  };

  const lifeDarko: LifelongStudent = {
    id: 'life-darko',
    studentKey: 'SAIS-2025-0021',
    name: 'DARKO KOJO',
    gender: 'Male',
    schoolId,
    yearJoined: 2025,
    status: 'active',
  };

  const lifelongStudents = [
    lifeBoateng,
    lifeAdjei,
    lifeOwusu,
    lifeMidYear,
    lifeWithdrawn,
    lifeMensah,
    lifeDarko,
  ];

  const primaryCls = classes[0];
  const secondaryCls = classes[1];
  const y4Cls = classes[2];

  const enrollments: ClassEnrollment[] = [
    enrollmentFromClass(y4Cls, {
      id: 'enr-boateng-2324',
      studentId: 'life-boateng',
      studentKey: lifeBoateng.studentKey,
      classId: y4ClassId,
      academicYear: '2023_2024',
      rollNumber: 'SAISDAN04A002',
      index: '002',
      attendance: 58,
      enrolledTerms: ALL_TERMS,
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-boateng-2425',
      studentId: 'life-boateng',
      studentKey: lifeBoateng.studentKey,
      classId: primaryClassId,
      academicYear: '2024_2025',
      rollNumber: 'SAISDAN05A002',
      index: '002',
      attendance: 60,
      enrolledTerms: ALL_TERMS,
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-boateng-2526',
      studentId: 'life-boateng',
      studentKey: lifeBoateng.studentKey,
      classId: primaryClassId,
      academicYear: '2025_2026',
      rollNumber: 'SAISDAN05A002',
      index: '002',
      attendance: 62,
      // Demo: only Term 3 recorded this year (T1/T2 not enrolled on transcript)
      enrolledTerms: ['T3'],
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-adjei',
      studentId: 'life-adjei',
      studentKey: lifeAdjei.studentKey,
      classId: primaryClassId,
      rollNumber: 'SAISDAN05A001',
      index: '001',
      attendance: 60,
      enrolledTerms: ALL_TERMS,
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-owusu',
      studentId: 'life-owusu',
      studentKey: lifeOwusu.studentKey,
      classId: primaryClassId,
      rollNumber: 'SAISDAN05A003',
      index: '003',
      attendance: 58,
      enrolledTerms: ALL_TERMS,
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-midyear',
      studentId: 'life-midyear',
      studentKey: lifeMidYear.studentKey,
      classId: primaryClassId,
      rollNumber: 'SAISDAN05A010',
      index: '010',
      attendance: 40,
      enrolledTerms: ['T2', 'T3'],
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-withdrawn',
      studentId: 'life-withdrawn',
      studentKey: lifeWithdrawn.studentKey,
      classId: primaryClassId,
      rollNumber: 'SAISDAN05A011',
      index: '011',
      attendance: 20,
      enrolledTerms: ['T1'],
    }),
    enrollmentFromClass(secondaryCls, {
      id: 'enr-mensah',
      studentId: 'life-mensah',
      studentKey: lifeMensah.studentKey,
      classId: secondaryClassId,
      rollNumber: 'SAISDAN09A001',
      index: '001',
      attendance: 61,
      enrolledTerms: ALL_TERMS,
    }),
    enrollmentFromClass(secondaryCls, {
      id: 'enr-darko',
      studentId: 'life-darko',
      studentKey: lifeDarko.studentKey,
      classId: secondaryClassId,
      rollNumber: 'SAISDAN09A002',
      index: '002',
      attendance: 59,
      enrolledTerms: ALL_TERMS,
    }),
  ];

  const scores: AssessmentScore[] = [];
  const summaries: ReportSummary[] = [];

  const pushScore = (
    roll: string,
    classId: string,
    academicYear: string,
    term: TermCode,
    subjectCode: string,
    cw: number,
    mt: number,
    eot: number
  ) => {
    const termKey = buildTermKey(academicYear, term);
    const total = cw + mt + eot;
    scores.push({
      id: createId(),
      studentId: roll,
      classId,
      subjectCode,
      mode: 'EOT',
      termKey,
      academicYear,
      cwScore: cw,
      mtScore: mt,
      eotScore: eot,
      totalScore: total,
      grade: gradeFromTotal(total),
      comment: '',
    });
  };

  const pushSummary = (
    roll: string,
    classId: string,
    className: string,
    programme: Programme,
    academicYear: string,
    term: TermCode,
    finalized: boolean,
    subjectLines: SubjectLineSnapshot[] | null,
    aggregates?: Partial<ReportSummary>
  ) => {
    const termKey = buildTermKey(academicYear, term);
    summaries.push({
      id: createId(),
      studentId: roll,
      classId,
      mode: 'EOT',
      termKey,
      academicYear,
      rawScore: aggregates?.rawScore ?? (finalized ? 420 : null),
      averageScore: aggregates?.averageScore ?? (finalized ? 70 : null),
      aveGrade: aggregates?.aveGrade ?? (finalized ? 'B' : null),
      bestMark: aggregates?.bestMark ?? (finalized ? 85 : null),
      bestGrade: aggregates?.bestGrade ?? (finalized ? 'A' : null),
      leastMark: aggregates?.leastMark ?? (finalized ? 55 : null),
      leastGrade: aggregates?.leastGrade ?? (finalized ? 'D' : null),
      rank: aggregates?.rank ?? (finalized ? 1 : null),
      peComment: aggregates?.peComment ?? '',
      clubComment: aggregates?.clubComment ?? '',
      generalComment: aggregates?.generalComment ?? '',
      teacherName: programme === 'PRIMARY' ? 'Akosua Mensah' : 'Kwame Asante',
      className,
      programme,
      finalized,
      subjectLines,
    });
  };

  const primaryLifeIds = ['life-adjei', 'life-boateng', 'life-owusu'];
  const termKey2526T3 = buildTermKey('2025_2026', 'T3');

  for (const roll of primaryLifeIds) {
    for (const code of ['ENG', 'MATH', 'SCI', 'BK', 'FRE', 'HUM', 'ICT']) {
      pushScore(roll, primaryClassId, '2025_2026', 'T3', code, 16, 15, 48);
    }
    scores.push({
      id: createId(),
      studentId: roll,
      classId: primaryClassId,
      subjectCode: 'MUSIC',
      mode: 'EOT',
      termKey: termKey2526T3,
      academicYear: '2025_2026',
      totalScore: 78,
      grade: 'B',
      comment: '',
    });
  }

  for (const roll of ['life-mensah', 'life-darko']) {
    for (const code of ['ENG', 'LIT', 'MATH', 'BIO', 'CHEM', 'PHY', 'ICT', 'GEO', 'HIST', 'FRE']) {
      pushScore(roll, secondaryClassId, '2025_2026', 'T3', code, 15, 14, 46);
    }
  }

  const boatengLines = demoSubjectLines([
    { code: 'ENG', name: 'English', total: 79 },
    { code: 'MATH', name: 'Mathematics', total: 72 },
    { code: 'SCI', name: 'Science', total: 74 },
  ]);

  for (const term of ALL_TERMS) {
    pushSummary(
      'life-boateng',
      y4ClassId,
      'YEAR FOUR (B)',
      'PRIMARY',
      '2023_2024',
      term,
      true,
      boatengLines
    );
    for (const code of ['ENG', 'MATH', 'SCI']) {
      pushScore('life-boateng', y4ClassId, '2023_2024', term, code, 15, 14, 45);
    }
  }

  for (const term of ['T1', 'T2'] as TermCode[]) {
    pushSummary(
      'life-boateng',
      primaryClassId,
      'YEAR FIVE (A)',
      'PRIMARY',
      '2024_2025',
      term,
      true,
      boatengLines
    );
    for (const code of ['ENG', 'MATH', 'SCI']) {
      pushScore('life-boateng', primaryClassId, '2024_2025', term, code, 16, 15, 46);
    }
  }

  pushSummary(
    'life-boateng',
    primaryClassId,
    'YEAR FIVE (A)',
    'PRIMARY',
    '2024_2025',
    'T3',
    false,
    null,
    { generalComment: 'Draft — pending finalization' }
  );
  for (const code of ['ENG', 'MATH', 'SCI']) {
    pushScore('life-boateng', primaryClassId, '2024_2025', 'T3', code, 14, 13, 40);
  }

  pushSummary(
    'life-boateng',
    primaryClassId,
    'YEAR FIVE (A)',
    'PRIMARY',
    '2025_2026',
    'T3',
    true,
    boatengLines
  );

  // Mid-year joiner: T2 finalized, T3 placeholder (enrolledTerms T2+T3)
  pushSummary(
    'life-midyear',
    primaryClassId,
    'YEAR FIVE (A)',
    'PRIMARY',
    '2025_2026',
    'T2',
    true,
    demoSubjectLines([
      { code: 'ENG', name: 'English', total: 68 },
      { code: 'MATH', name: 'Mathematics', total: 71 },
    ])
  );
  // Mid-year withdrawal: T1 only
  pushSummary(
    'life-withdrawn',
    primaryClassId,
    'YEAR FIVE (A)',
    'PRIMARY',
    '2025_2026',
    'T1',
    true,
    demoSubjectLines([
      { code: 'ENG', name: 'English', total: 60 },
      { code: 'MATH', name: 'Mathematics', total: 55 },
    ])
  );

  const studentViews = enrollments
    .map((en) => {
      const life = lifelongStudents.find((l) => l.studentKey === en.studentKey);
      return life ? toStudentView(life, en) : null;
    })
    .filter(Boolean) as Student[];

  const contacts: Contact[] = studentViews
    .filter((s) => s.academicYear === '2025_2026')
    .map((s, i) => ({
      id: `contact-${s.id}`,
      studentId: s.id,
      classId: s.classId,
      phone: `23324${String(1000000 + i).slice(-7)}`,
      email: `${s.studentId.toLowerCase()}@parent.sais.edu.gh`,
      pdfId: '',
      midtermPdfId: '',
      whatsappStatus: '',
      emailStatus: '',
    }));

  return {
    schools,
    users,
    classes,
    lifelongStudents,
    enrollments,
    scores,
    summaries,
    contacts,
    subjectContexts: [] as SubjectContext[],
    bannedTokens: [] as BannedTokenLedger[],
    activeClassId: primaryClassId,
    keySeq: { '2023': 42, '2024': 55, '2025': 100 },
  };
}

export function termKeyFromSettings(settings: ClassSettings): string {
  const year = parseAcademicYear(settings.termYearInfo);
  const n = detectTermNumber(settings.termYearInfo) || 3;
  return buildTermKey(year, n);
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [dbReady, setDbReady] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassStream[]>([]);
  const [lifelongStudents, setLifelongStudents] = useState<LifelongStudent[]>([]);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [subjectContexts, setSubjectContexts] = useState<SubjectContext[]>([]);
  const [bannedTokens, setBannedTokens] = useState<BannedTokenLedger[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [keySeq, setKeySeq] = useState<Record<string, number>>({});
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('2026/2027');

  const filteredClassStreams = useMemo(() => {
    const normSelected = normalizeYearId(selectedAcademicYearId);
    return classes.filter(
      (cs) => normalizeYearId(getStreamYearId(cs)) === normSelected
    );
  }, [classes, selectedAcademicYearId]);

  useEffect(() => {
    if (!filteredClassStreams.length) return;

    const currentBelongs = filteredClassStreams.some((cs) => cs.id === activeClassId);

    if (!currentBelongs) {
      const normSelected = normalizeYearId(selectedAcademicYearId);
      const targetId = `${normSelected}-YEAR-5A`;

      const year5AStream = filteredClassStreams.find(
        (cs) => cs.id === targetId || cs.id.endsWith('YEAR-5A') || cs.name.includes('YEAR 5A')
      );

      const nextStreamId = year5AStream ? year5AStream.id : filteredClassStreams[0].id;
      setActiveClassId(nextStreamId);
    }
  }, [selectedAcademicYearId, filteredClassStreams, activeClassId]);

  const students = useMemo(() => {
    const lifeByKey = new Map<string, LifelongStudent>(
      lifelongStudents.map((l) => [l.studentKey, l])
    );
    return enrollments
      .map((en) => {
        const life = lifeByKey.get(en.studentKey);
        return life ? toStudentView(life, en) : null;
      })
      .filter((s): s is Student => s !== null);
  }, [lifelongStudents, enrollments]);

  // Async hydrate via repository
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => {};

    const clearData = () => {
      setSchools([]);
      setUsers([]);
      setClasses([]);
      setLifelongStudents([]);
      setEnrollments([]);
      setScores([]);
      setSummaries([]);
      setContacts([]);
      setSubjectContexts([]);
      setBannedTokens([]);
      setActiveClassId(null);
      setKeySeq({});
      setDbReady(false);
      setDbLoading(false);
    };

    const loadData = async () => {
      setDbLoading(true);
      try {
        const loaded = await activeRepository.loadAll();
        const migrated = applyLegacyMigration(loaded);
        if (cancelled) return;
        setSchools(migrated.schools);
        setUsers(deduplicateUsersByEmail(migrated.users));
        setClasses(migrated.classes);
        setLifelongStudents(migrated.lifelongStudents);
        setEnrollments(migrated.enrollments);
        setScores(migrated.scores);
        setSummaries(migrated.summaries);
        setContacts(migrated.contacts);
        setSubjectContexts(migrated.subjectContexts);
        setBannedTokens(migrated.bannedTokens);
        setActiveClassId(migrated.activeClassId);
        setKeySeq(migrated.keySeq);
        await activeRepository.replaceAll(migrated);
        if (cancelled) return;
        setDbReady(true);
        void ensureBaselineAcademicYears();
      } catch (err) {
        console.error("Error loading data from repository, using demo snapshot fallback:", err);
        const fallbackSnap = applyLegacyMigration(buildDemoSnapshot());
        if (cancelled) return;
        setSchools(fallbackSnap.schools);
        setUsers(deduplicateUsersByEmail(fallbackSnap.users));
        setClasses(fallbackSnap.classes);
        setLifelongStudents(fallbackSnap.lifelongStudents);
        setEnrollments(fallbackSnap.enrollments);
        setScores(fallbackSnap.scores);
        setSummaries(fallbackSnap.summaries);
        setContacts(fallbackSnap.contacts);
        setSubjectContexts(fallbackSnap.subjectContexts);
        setBannedTokens(fallbackSnap.bannedTokens);
        setActiveClassId(fallbackSnap.activeClassId);
        setKeySeq(fallbackSnap.keySeq);
        setDbReady(true);
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    };

    if (import.meta.env.VITE_DATA_BACKEND === 'firestore') {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          loadData();
        } else {
          if (cancelled) return;
          clearData();
        }
      });
    } else {
      loadData();
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function useSaveEffect<T>(collectionName: any, data: T, ready: boolean) {
    const isInitialRender = useRef(true);
    useEffect(() => {
      if (!ready) return;
      if (isInitialRender.current) {
        isInitialRender.current = false;
        return;
      }
      void activeRepository.saveCollection(collectionName, data);
    }, [data, ready, collectionName]);
  }

  useSaveEffect('schools', schools, dbReady);
  useSaveEffect('users', users, dbReady);
  useSaveEffect('classes', classes, dbReady);
  useSaveEffect('lifelongStudents', lifelongStudents, dbReady);
  useSaveEffect('enrollments', enrollments, dbReady);
  useSaveEffect('scores', scores, dbReady);
  useSaveEffect('summaries', summaries, dbReady);
  useSaveEffect('contacts', contacts, dbReady);
  useSaveEffect('subjectContexts', subjectContexts, dbReady);
  useSaveEffect('bannedTokens', bannedTokens, dbReady);
  useSaveEffect('activeClassId', activeClassId, dbReady);
  useSaveEffect('keySeq', keySeq, dbReady);

  const cascadeEnrollmentTeachers = (classId: string, cls: ClassStream) => {
    const academicYear = parseAcademicYear(cls.settings.termYearInfo);
    const assignedSubjectIds = (cls.subjectTeachers ?? []).map((st) => st.teacherId);
    setEnrollments((prev) =>
      prev.map((en) => {
        if (en.classId !== classId || en.academicYear !== academicYear) return en;
        const merged = new Set(
          [...en.subjectTeacherIds, ...assignedSubjectIds, en.formTeacherId, cls.teacherId].filter(
            Boolean
          )
        );
        return {
          ...en,
          formTeacherId: cls.teacherId,
          subjectTeacherIds: Array.from(merged),
        };
      })
    );
  };

  const registerSchool = (school: Omit<School, 'id'>) => {
    const id = createId();
    setSchools((prev) => [...prev, { ...school, id }]);
    return id;
  };

  const updateSchool = (id: string, patch: Partial<School>) => {
    setSchools((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addTeacher = (teacher: Omit<User, 'id' | 'role'>) => {
    const id = createId();
    setUsers((prev) => [...prev, { ...teacher, role: 'teacher', id }]);
    return id;
  };

  const updateUser = (id: string, patch: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const createClass = (input: {
    name: string;
    schoolId: string;
    programme: Programme;
    teacherId: string;
    settings?: Partial<ClassSettings>;
  }) => {
    const id = createId();
    const stream: ClassStream = {
      id,
      name: input.name,
      schoolId: input.schoolId,
      programme: input.programme,
      teacherId: input.teacherId,
      subjectTeachers: [],
      settings: { ...DEFAULT_CLASS_SETTINGS(), ...input.settings },
    };
    setClasses((prev) => [...prev, stream]);
    if (!activeClassId) setActiveClassId(id);
    return id;
  };

  const updateClassSettings = (classId: string, settings: Partial<ClassSettings>) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId ? { ...c, settings: { ...c.settings, ...settings } } : c
      )
    );
  };

  const assignSubjectTeacher = (classId: string, subjectCode: string, teacherId: string) => {
    setClasses((prev) => {
      const next = prev.map((c) => {
        if (c.id !== classId) return c;
        const existing = c.subjectTeachers || [];
        const updated = [
          ...existing.filter((st) => st.subjectCode !== subjectCode),
          { subjectCode, teacherId },
        ];
        return { ...c, subjectTeachers: updated };
      });
      const cls = next.find((c) => c.id === classId);
      if (cls) cascadeEnrollmentTeachers(classId, cls);
      return next;
    });
  };

  const setFormTeacher = (classId: string, teacherId: string) => {
    setClasses((prev) => {
      const next = prev.map((c) => (c.id === classId ? { ...c, teacherId } : c));
      const cls = next.find((c) => c.id === classId);
      if (cls) cascadeEnrollmentTeachers(classId, cls);
      return next;
    });
  };

  const findLifelongByRef = (ref: string): LifelongStudent | undefined => {
    const byIdOrKey = lifelongStudents.find((l) => l.id === ref || l.studentKey === ref);
    if (byIdOrKey) return byIdOrKey;
    const en = enrollments.find((e) => e.studentId === ref || e.rollNumber === ref);
    if (!en) return undefined;
    return lifelongStudents.find((l) => l.studentKey === en.studentKey);
  };

  const addStudent = (
    input: Omit<Student, 'id' | 'studentKey' | 'yearJoined' | 'status'> & {
      enrolledTerms?: TermCode[];
      yearJoined?: number;
    }
  ): string => {
    const cls = classes.find((c) => c.id === input.classId);
    if (!cls) throw new Error('Class not found');

    const academicYear = parseAcademicYear(cls.settings.termYearInfo);
    const rollNumber = input.studentId.trim().toUpperCase();

    if (
      enrollments.some(
        (e) =>
          e.classId === input.classId &&
          e.academicYear === academicYear &&
          e.rollNumber === rollNumber
      )
    ) {
      throw new Error(`Roll number ${rollNumber} already exists in this class for ${academicYear}`);
    }

    const yearJoined =
      input.yearJoined ?? yearStartFromAcademicYear(academicYear);

    let studentKey: string;
    let nextSeq = { ...keySeq };
    const minted = mintStudentKey(yearJoined, nextSeq);
    studentKey = minted.studentKey;
    nextSeq = minted.seq;

    if (lifelongStudents.some((l) => l.studentKey === studentKey)) {
      throw new Error(`Duplicate studentKey ${studentKey}`);
    }

    const lifeId = createId();
    const life: LifelongStudent = {
      id: lifeId,
      studentKey,
      name: input.name,
      gender: input.gender,
      schoolId: input.schoolId,
      yearJoined,
      status: 'active',
    };

    const enrollment = enrollmentFromClass(cls, {
      id: createId(),
      studentId: lifeId,
      studentKey,
      classId: input.classId,
      rollNumber,
      index: input.index,
      attendance: input.attendance,
      enrolledTerms: input.enrolledTerms ?? ALL_TERMS,
    });

    setKeySeq(nextSeq);
    setLifelongStudents((prev) => [...prev, life]);
    setEnrollments((prev) => [...prev, enrollment]);
    setContacts((prev) => [
      ...prev,
      {
        id: createId(),
        studentId: lifeId,
        classId: input.classId,
        phone: '',
        email: '',
        pdfId: '',
        midtermPdfId: '',
        whatsappStatus: '',
        emailStatus: '',
      },
    ]);

    return lifeId;
  };

  const enrollExistingStudent = (input: {
    studentKey?: string;
    studentId?: string;
    classId: string;
    rollNumber: string;
    index: string;
    enrolledTerms?: TermCode[];
    attendance?: number;
  }): string => {
    const ref = input.studentKey ?? input.studentId;
    if (!ref) throw new Error('studentKey or studentId required');

    const life = findLifelongByRef(ref);
    if (!life) throw new Error('Lifelong student not found');

    const cls = classes.find((c) => c.id === input.classId);
    if (!cls) throw new Error('Class not found');

    const academicYear = parseAcademicYear(cls.settings.termYearInfo);
    const rollNumber = input.rollNumber.trim().toUpperCase();

    if (
      enrollments.some(
        (e) => e.studentKey === life.studentKey && e.academicYear === academicYear
      )
    ) {
      throw new Error(`${life.studentKey} already enrolled in ${academicYear}`);
    }

    if (
      enrollments.some(
        (e) => e.rollNumber === rollNumber && e.academicYear === academicYear
      )
    ) {
      throw new Error(`Roll ${rollNumber} already used in ${academicYear}`);
    }

    const enrollment = enrollmentFromClass(cls, {
      id: createId(),
      studentId: life.id,
      studentKey: life.studentKey,
      classId: input.classId,
      rollNumber,
      index: input.index,
      attendance: input.attendance ?? cls.settings.attendanceTotal,
      enrolledTerms: input.enrolledTerms ?? ALL_TERMS,
    });

    setEnrollments((prev) => [...prev, enrollment]);
    return enrollment.id;
  };

  const updateStudent = (id: string, patch: Partial<Student>) => {
    const life = lifelongStudents.find((l) => l.id === id);
    if (!life) return;

    setLifelongStudents((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        return {
          ...l,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
        };
      })
    );

    const targetClassId = patch.classId;
    const targetYear = patch.academicYear;

    setEnrollments((prev) => {
      const mine = prev
        .filter((en) => en.studentKey === life.studentKey)
        .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

      let targetId: string | undefined;
      if (targetClassId && targetYear) {
        targetId = mine.find(
          (en) => en.classId === targetClassId && en.academicYear === targetYear
        )?.id;
      } else if (targetClassId) {
        targetId = mine.find((en) => en.classId === targetClassId)?.id;
      } else {
        targetId = mine[0]?.id;
      }

      if (!targetId) return prev;

      return prev.map((en) => {
        if (en.id !== targetId) return en;
        return {
          ...en,
          ...(patch.attendance !== undefined ? { attendance: patch.attendance } : {}),
          ...(patch.index !== undefined ? { index: patch.index } : {}),
          ...(patch.studentId !== undefined
            ? { studentId: patch.studentId, rollNumber: patch.studentId }
            : {}),
          ...(patch.enrolledTerms !== undefined ? { enrolledTerms: patch.enrolledTerms } : {}),
        };
      });
    });
  };

  const transferStudent = (studentId: string, lastTerm: TermCode) => {
    const life = findLifelongByRef(studentId);
    if (!life) throw new Error('Student not found');

    setLifelongStudents((prev) =>
      prev.map((l) => (l.id === life.id ? { ...l, status: 'transferred' } : l))
    );

    const studentEnrollments = enrollments
      .filter((e) => e.studentKey === life.studentKey)
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

    const current = studentEnrollments[0];
    if (!current) return;

    setEnrollments((prev) =>
      prev.map((en) =>
        en.id === current.id
          ? { ...en, enrolledTerms: termsThroughLast(lastTerm) }
          : en
      )
    );
  };

  const upsertScore = (score: Omit<AssessmentScore, 'id'>) => {
    const normalized = normalizeTermFields(score);
    if (!normalized.academicYear) throw new Error('academicYear is required on scores');
    setScores((prev) => {
      const key = scoreKey(normalized);
      const idx = prev.findIndex((p) => scoreKey(p) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...normalized };
        return next;
      }
      return [...prev, { ...normalized, id: createId() }];
    });
  };

  const upsertScores = (list: Omit<AssessmentScore, 'id'>[]) => {
    setScores((prev) => {
      const map = new Map<string, AssessmentScore>(prev.map((p) => [scoreKey(p), p]));
      for (const score of list) {
        const normalized = normalizeTermFields(score);
        if (!normalized.academicYear) throw new Error('academicYear is required on scores');
        const key = scoreKey(normalized);
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...normalized, id: existing.id });
        } else {
          map.set(key, { ...normalized, id: createId() });
        }
      }
      return Array.from(map.values());
    });
  };

  const saveSummaries = (reports: Omit<ReportSummary, 'id'>[]) => {
    setSummaries((prev) => {
      const map = new Map<string, ReportSummary>(prev.map((p) => [summaryKey(p), p]));
      for (const report of reports) {
        const normalized = normalizeTermFields(report);
        const key = summaryKey(normalized);
        const existing = map.get(key);
        map.set(key, {
          ...existing,
          ...normalized,
          id: existing?.id ?? createId(),
        });
      }
      return Array.from(map.values());
    });
  };

  const finalizeReports = (reports: Omit<ReportSummary, 'id'>[]) => {
    saveSummaries(
      reports.map((r) => ({
        ...r,
        finalized: true,
        subjectLines: r.subjectLines ?? [],
      }))
    );
  };

  const unfinalizeReport = (
    studentId: string,
    academicYear: string,
    termKey: string,
    mode: ReportMode = 'EOT'
  ) => {
    setSummaries((prev) =>
      prev.map((s) => {
        if (
          s.studentId !== studentId ||
          s.academicYear !== academicYear ||
          s.termKey !== termKey ||
          s.mode !== mode
        ) {
          return s;
        }
        return {
          ...s,
          finalized: false,
          subjectLines: null,
          rawScore: null,
          averageScore: null,
          aveGrade: null,
          bestMark: null,
          bestGrade: null,
          leastMark: null,
          leastGrade: null,
          rank: null,
        };
      })
    );
  };

  const replaceScores = (next: AssessmentScore[]) => setScores(next);
  const replaceSummaries = (next: ReportSummary[]) => setSummaries(next);

  const upsertContact = (contact: Omit<Contact, 'id'> & { id?: string }) => {
    setContacts((prev) => {
      const idx = prev.findIndex(
        (c) => c.studentId === contact.studentId && c.classId === contact.classId
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...contact };
        return next;
      }
      return [...prev, { ...contact, id: contact.id || createId() }];
    });
  };

  const updateContactStatus = (
    studentId: string,
    classId: string,
    patch: Partial<
      Pick<Contact, 'pdfId' | 'midtermPdfId' | 'whatsappStatus' | 'emailStatus' | 'phone' | 'email'>
    >
  ) => {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.studentId === studentId && c.classId === classId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          id: createId(),
          studentId,
          classId,
          phone: '',
          email: '',
          pdfId: '',
          midtermPdfId: '',
          whatsappStatus: '',
          emailStatus: '',
          ...patch,
        },
      ];
    });
  };

  const saveSubjectContext = (ctx: SubjectContext) => {
    setSubjectContexts((prev) => {
      const idx = prev.findIndex(
        (c) => c.classId === ctx.classId && c.subjectCode === ctx.subjectCode
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ctx;
        return next;
      }
      return [...prev, ctx];
    });
  };

  const mergeBannedTokens = (
    studentId: string,
    classId: string,
    termKey: string,
    tokens: string[]
  ) => {
    setBannedTokens((prev) => {
      const idx = prev.findIndex(
        (b) => b.studentId === studentId && b.classId === classId && b.termKey === termKey
      );
      if (idx >= 0) {
        const next = [...prev];
        const merged = Array.from(new Set([...next[idx].tokens, ...tokens]));
        next[idx] = { ...next[idx], tokens: merged };
        return next;
      }
      return [...prev, { studentId, classId, termKey, tokens: [...tokens] }];
    });
  };

  const clearAllData = () => {
    setSchools([]);
    setUsers([]);
    setClasses([]);
    setLifelongStudents([]);
    setEnrollments([]);
    setScores([]);
    setSummaries([]);
    setContacts([]);
    setSubjectContexts([]);
    setBannedTokens([]);
    setActiveClassId(null);
    setKeySeq({});
    void activeRepository.clearAll();
  };

  const seedDemoData = () => {
    const demo = buildDemoSnapshot();
    setSchools(demo.schools);
    setUsers(demo.users);
    setClasses(demo.classes);
    setLifelongStudents(demo.lifelongStudents);
    setEnrollments(demo.enrollments);
    setScores(demo.scores);
    setSummaries(demo.summaries);
    setContacts(demo.contacts);
    setSubjectContexts(demo.subjectContexts);
    setBannedTokens(demo.bannedTokens);
    setActiveClassId(demo.activeClassId);
    setKeySeq(demo.keySeq);
    void activeRepository.replaceAll({
      schools: demo.schools,
      users: demo.users,
      classes: demo.classes,
      lifelongStudents: demo.lifelongStudents,
      enrollments: demo.enrollments,
      scores: demo.scores,
      summaries: demo.summaries,
      contacts: demo.contacts,
      subjectContexts: demo.subjectContexts,
      bannedTokens: demo.bannedTokens,
      activeClassId: demo.activeClassId,
      keySeq: demo.keySeq,
    });
  };

  const saveSubjectResults = (
    result: Omit<AssessmentScore, 'id'> & { subjectName?: string }
  ) => {
    const { subjectName, ...rest } = result;
    const cls = classes.find((c) => c.id === rest.classId);
    const academicYear =
      rest.academicYear ??
      (cls ? parseAcademicYear(cls.settings.termYearInfo) : '2025_2026');
    upsertScore({
      ...rest,
      subjectCode: rest.subjectCode || subjectName || 'UNK',
      mode: rest.mode || 'EOT',
      termKey: rest.termKey || buildTermKey(academicYear, 'T3'),
      academicYear,
      classId: rest.classId || '',
    });
  };

  if (dbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sais-cream text-sais-muted text-sm">
        Loading school data…
      </div>
    );
  }

  return (
    <DatabaseContext.Provider
      value={{
        dbReady,
        dbLoading,
        schools,
        users,
        classes,
        lifelongStudents,
        enrollments,
        students,
        scores,
        summaries,
        contacts,
        subjectContexts,
        bannedTokens,
        activeClassId,
        setActiveClassId,
        selectedAcademicYearId,
        setSelectedAcademicYearId,
        filteredClassStreams,
        availableStreams: filteredClassStreams,
        registerSchool,
        updateSchool,
        addTeacher,
        updateUser,
        createClass,
        updateClassSettings,
        assignSubjectTeacher,
        setFormTeacher,
        addStudent,
        enrollExistingStudent,
        updateStudent,
        transferStudent,
        upsertScore,
        upsertScores,
        replaceScores,
        replaceSummaries,
        saveSummaries,
        finalizeReports,
        unfinalizeReport,
        upsertContact,
        updateContactStatus,
        saveSubjectContext,
        mergeBannedTokens,
        createAcademicYear: (year: string, status: 'active' | 'upcoming' = 'upcoming') =>
          createAcademicYearWith3Terms(year, status),
        seedDemoData,
        clearAllData,
        results: scores,
        finalReports: summaries,
        saveSubjectResults,
        saveFinalReports: saveSummaries,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export function useActiveClass() {
  const {
    classes,
    activeClassId,
    setActiveClassId,
    students,
    enrollments,
    lifelongStudents,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    filteredClassStreams,
    availableStreams,
  } = useDatabase();
  const activeClass =
    classes.find((c) => c.id === activeClassId) ||
    filteredClassStreams[0] ||
    classes[0] ||
    null;
  const academicYear = activeClass
    ? parseAcademicYear(activeClass.settings.termYearInfo)
    : '';

  const classStudents = useMemo(() => {
    if (!activeClass) return [];

    const map = new Map<string, Student>();

    // 1. Direct students matching activeClass.id
    students
      .filter((s) => s.classId === activeClass.id || s.currentClassStreamId === activeClass.id)
      .forEach((s) => map.set(s.studentKey || s.id, s));

    // 2. Class enrollments matching activeClass.id
    enrollments
      .filter((e) => e.classId === activeClass.id)
      .forEach((e) => {
        const key = e.studentKey || e.studentId;
        if (!map.has(key)) {
          const l = lifelongStudents.find((ls) => ls.studentKey === e.studentKey || ls.id === e.studentId);
          map.set(key, {
            id: e.studentId,
            studentKey: e.studentKey || key,
            studentId: e.rollNumber || e.studentId,
            name: l?.name || e.studentId,
            gender: l?.gender || 'Male',
            index: e.index || '001',
            classId: activeClass.id,
            academicYear: activeClass.academicYear || academicYear,
            attendance: e.attendance || 60,
            schoolId: activeClass.schoolId || 'sais-school-main',
            status: l?.status || 'active',
            yearJoined: 2025,
            enrolledTerms: e.enrolledTerms || ['T1', 'T2', 'T3'],
          });
        }
      });

    // 3. Fallback: If map is empty for 2025/2026 Year 5A primary class, check lifelongStudents
    if (map.size === 0 && (activeClass.id === '2025-2026-YEAR-5A' || activeClass.id === 'demo-primary-class')) {
      lifelongStudents.forEach((l, idx) => {
        const idxStr = String(idx + 1).padStart(3, '0');
        map.set(l.studentKey, {
          id: `SAISDAN05A${idxStr}`,
          studentKey: l.studentKey,
          studentId: `SAISDAN05A${idxStr}`,
          name: l.name,
          gender: l.gender || 'Male',
          index: idxStr,
          classId: activeClass.id,
          academicYear: activeClass.academicYear || academicYear,
          attendance: 64,
          schoolId: 'sais-school-main',
          status: 'active',
          yearJoined: 2025,
          enrolledTerms: ['T1', 'T2', 'T3'],
        });
      });
    }

    // Sort strictly ascending by numeric index (001, 002, 003...)
    return Array.from(map.values()).sort((a, b) => {
      const numA = parseInt(a.index, 10) || 0;
      const numB = parseInt(b.index, 10) || 0;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [students, enrollments, lifelongStudents, activeClass, academicYear]);

  return {
    activeClass,
    activeClassId: activeClass?.id ?? null,
    selectedClassStreamId: activeClass?.id ?? null,
    setActiveClassId,
    classes,
    filteredClassStreams,
    availableStreams,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    classStudents,
    academicYear,
  };
}
