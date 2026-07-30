import { User, ClassStream, ClassSettings, LifelongStudent, ClassEnrollment, Student, AssessmentScore, ReportSummary, TermCode, SubjectLineSnapshot, School, Contact, SubjectContext, BannedTokenLedger, Programme, ReportMode } from '../types';
import { parseAcademicYear, buildTermKey, parseTermKey, toCanonicalTermKey, formatStudentKey, yearStartFromAcademicYear, termsThroughLast, ALL_TERMS } from '../lib/academicYear';
import { detectTermNumber } from '../lib/term';
import { createId, KEYS, localRepository, SaisSnapshot } from '../data';
import { DEFAULT_CLASS_SETTINGS } from '../types';

export const normalizeYearId = (id?: string) => (id ? id.replace('/', '-').trim() : '');

export const getStreamYearId = (cs: ClassStream, fallback: string = '2026-2027'): string => {
  if (cs.academicYearId) return normalizeYearId(cs.academicYearId);
  if (cs.academicYear) return normalizeYearId(cs.academicYear);
  const parts = cs.id.split('-');
  if (parts.length >= 2 && /^\\d{4}$/.test(parts[0]) && /^\\d{4}$/.test(parts[1])) {
    return `${parts[0]}-${parts[1]}`;
  }
  if (cs.settings?.termYearInfo) {
    const y = cs.settings.termYearInfo.split(' — ')[0] || cs.settings.termYearInfo.split(' - ')[0];
    if (y) return normalizeYearId(y);
  }
  return fallback;
};

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

export function scoreKey(s: Pick<AssessmentScore, 'studentId' | 'subjectCode' | 'mode' | 'termKey'>) {
  return `${s.studentId}|${s.subjectCode}|${s.mode}|${s.termKey}`;
}

export function summaryKey(
  r: Pick<ReportSummary, 'studentId' | 'academicYear' | 'termKey' | 'mode'>
) {
  return `${r.studentId}|${r.academicYear}|${r.termKey}|${r.mode}`;
}

export function toStudentView(life: LifelongStudent, en: ClassEnrollment): Student {
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

export function normalizeTermFields<T extends { termKey: string; academicYear?: string }>(
  item: T
): T {
  if (!item.termKey) return item;
  const parsed = parseTermKey(item.termKey);
  if (!parsed.termCode) {
    console.warn(`[TermKey Warning] Unrecognized key structure in record (preserving as-is):`, item.termKey);
    return item;
  }
  const cleanYear = item.academicYear || parsed.academicYear;
  return {
    ...item,
    academicYear: cleanYear,
    termKey: toCanonicalTermKey(cleanYear, parsed.termCode),
  };
}

export function enrollmentFromClass(
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

export function mintStudentKey(
  yearJoined: number,
  keySeq: Record<string, number>
): { studentKey: string; seq: Record<string, number> } {
  const currentGlobal = Math.max(
    keySeq['global'] ?? 0,
    ...Object.values(keySeq).map((v) => (typeof v === 'number' ? v : 0))
  );
  const next = currentGlobal + 1;
  const yearStr = String(yearJoined);
  return {
    studentKey: formatStudentKey(next),
    seq: { ...keySeq, global: next, [yearStr]: (keySeq[yearStr] ?? 0) + 1 },
  };
}

export function gradeFromTotal(total: number): string {
  if (total >= 90) return 'A*';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  if (total >= 40) return 'E';
  return 'U';
}

export function termKeyFromSettings(settings: ClassSettings): string {
  const year = parseAcademicYear(settings.termYearInfo);
  const n = detectTermNumber(settings.termYearInfo) || 3;
  return buildTermKey(year, n);
}

import { HISTORICAL_YEAR5A_SCORES, HISTORICAL_YEAR5A_SUMMARIES } from '../data/year5aHistoricalData';
import { HISTORICAL_YEAR6_SCORES, HISTORICAL_YEAR6_SUMMARIES } from '../data/year6HistoricalData';
import { HISTORICAL_YEAR3_SCORES, HISTORICAL_YEAR3_SUMMARIES } from '../data/year3HistoricalData';
import { HISTORICAL_YEAR1_SCORES, HISTORICAL_YEAR1_SUMMARIES } from '../data/year1HistoricalData';
import { HISTORICAL_YEAR2_SCORES, HISTORICAL_YEAR2_SUMMARIES } from '../data/year2HistoricalData';
import { HISTORICAL_YEAR7_SCORES, HISTORICAL_YEAR7_SUMMARIES } from '../data/year7HistoricalData';

export function normalizeStudentIdToKey(id?: string): string {
  if (!id) return '';
  if (id.startsWith('SAIS-STU-')) return id;
  if (id.startsWith('SAIS-2025-')) {
    const num = parseInt(id.slice(10), 10);
    if (!isNaN(num)) {
      if (num >= 197 && num <= 221) {
        return `SAIS-STU-${String(num).padStart(4, '0')}`;
      }
      if (num >= 1 && num <= 25) {
        return `SAIS-STU-${String(196 + num).padStart(4, '0')}`;
      }
    }
  }
  const match = id.match(/SAISDAN(?:01A|05A)?0*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const effectiveNum = num === 26 ? 25 : num;
    const globalSeq = 196 + effectiveNum;
    return `SAIS-STU-${String(globalSeq).padStart(4, '0')}`;
  }
  return id;
}

export const REAL_YEAR5A_STUDENTS: { id: string; index: string; name: string; gender: 'Male' | 'Female'; enrolledTerms?: TermCode[] }[] = [
  { id: 'SAIS-STU-0197', index: '001', name: 'Abrahams Jeslyn', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0198', index: '002', name: 'Acquah Zoe', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0199', index: '003', name: 'Aduam Elnathan', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0200', index: '004', name: 'Agbenyo Florence', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0201', index: '005', name: 'Akonor Jeremy', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0202', index: '006', name: 'Ankomah Ohene Fiifi', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0203', index: '007', name: 'Armah Eric Glenn', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0204', index: '008', name: 'Aryee Nolan', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0205', index: '009', name: 'Bimpong Bernard', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0206', index: '010', name: 'Buabeng Obaa Amponsah', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0207', index: '011', name: 'Denteh Jotham', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0208', index: '012', name: 'Freshpound Yuki', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0209', index: '013', name: 'Gyansah Gerald', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0210', index: '014', name: 'Lawson Elaine', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0211', index: '015', name: 'Mensa Nuku Atawa', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0212', index: '016', name: 'Neequaye Janelle', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0213', index: '017', name: 'Obeng Kalmin', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0214', index: '018', name: 'Okine Blessing', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0215', index: '019', name: 'Opoku-Baffour Joel', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0216', index: '020', name: 'Owusu Ansah Nathan', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0217', index: '021', name: 'Sackey Raphael', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0218', index: '022', name: 'Salifu Marriam Imani', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0219', index: '023', name: 'Sampson Elsie', gender: 'Female', enrolledTerms: ['T1', 'T2', 'T3'] },
  { id: 'SAIS-STU-0220', index: '024', name: 'Willis Cincinatus', gender: 'Male', enrolledTerms: ['T1', 'T2', 'T3'] },
];

export function applyLegacyMigration(snap: SaisSnapshot): SaisSnapshot {
  let seq = { ...snap.keySeq };

  // Purge obsolete demo classes and normalize names of canonical streams
  const obsoleteClassIds = new Set([
    'demo-primary-class',
    'demo-secondary-class',
    'demo-y4',
  ]);
  const obsoleteNames = new Set([
    'YEAR FIVE (A)',
    'YEAR NINE (A)',
    'YEAR FOUR (B)',
    'DEMO PRIMARY CLASS (YEAR 5)',
  ]);

  let classes = (snap.classes || [])
    .filter(
      (c) =>
        !obsoleteClassIds.has(c.id) &&
        !obsoleteNames.has(c.name) &&
        !c.name.includes('FIVE (A)') &&
        !c.name.includes('NINE (A)') &&
        !c.name.includes('FOUR (B)')
    )
    .map((c) => {
      if (c.id.endsWith('YEAR-5A') || c.name === 'YEAR FIVE (A)') {
        return { ...c, name: 'YEAR 5A' };
      }
      return c;
    });

  // 1. Normalize all existing lifelong student IDs to SAIS-STU-XXXX keys
  let rawLifelong = snap.lifelongStudents.map((l) => {
    const canonicalKey = normalizeStudentIdToKey(l.studentKey || l.id);
    return {
      ...l,
      id: canonicalKey,
      studentKey: canonicalKey,
    };
  });

  // Deduplicate lifelongStudents by canonical key
  const lifeMap = new Map<string, LifelongStudent>();
  for (const l of rawLifelong) {
    if (!lifeMap.has(l.studentKey)) {
      lifeMap.set(l.studentKey, l);
    } else {
      const existing = lifeMap.get(l.studentKey)!;
      lifeMap.set(l.studentKey, {
        ...existing,
        ...l,
        name: (l.name && l.name.trim()) ? l.name : existing.name,
      });
    }
  }
  let lifelongStudents = Array.from(lifeMap.values());

  // 2. Normalize and deduplicate enrollments
  let rawEnrollments = snap.enrollments
    .filter((e) => !obsoleteClassIds.has(e.classId))
    .map((e) => {
      const canonicalKey = normalizeStudentIdToKey(e.studentKey || e.studentId);
      return {
        ...e,
        studentId: canonicalKey,
        studentKey: canonicalKey,
      };
    });

  // Deduplicate enrollments by classId + studentKey
  const enrMap = new Map<string, ClassEnrollment>();
  for (const e of rawEnrollments) {
    if (e.classId === '2025-2026-YEAR-5A' && e.studentId.startsWith('life-')) continue;

    const compositeKey = `${e.classId}|${e.studentKey}`;
    if (!enrMap.has(compositeKey)) {
      enrMap.set(compositeKey, e);
    } else {
      const existing = enrMap.get(compositeKey)!;
      if ((e.attendance && e.attendance > existing.attendance) || existing.rollNumber.startsWith('SAIS-2025-')) {
        enrMap.set(compositeKey, e);
      }
    }
  }
  let enrollments = Array.from(enrMap.values());

  // 3. Ensure real 25 students for 2025-2026 Year 5A exist as lifelongStudents & enrollments with clean rollNumber
  for (const st of REAL_YEAR5A_STUDENTS) {
    const existingLifeIdx = lifelongStudents.findIndex((l) => l.id === st.id || l.studentKey === st.id);
    if (existingLifeIdx >= 0) {
      lifelongStudents[existingLifeIdx] = {
        ...lifelongStudents[existingLifeIdx],
        name: st.name,
        gender: st.gender,
      };
    } else {
      lifelongStudents.push({
        id: st.id,
        studentKey: st.id,
        name: st.name,
        gender: st.gender,
        schoolId: 'sais-school-main',
        yearJoined: 2025,
        status: 'active',
      });
    }

    const studentEnrolledTerms = st.enrolledTerms || ALL_TERMS;
    const existingEnrIdx = enrollments.findIndex(
      (e) => e.classId === '2025-2026-YEAR-5A' && (e.studentId === st.id || e.studentKey === st.id)
    );
    if (existingEnrIdx >= 0) {
      enrollments[existingEnrIdx] = {
        ...enrollments[existingEnrIdx],
        rollNumber: st.index,
        studentId: st.id,
        studentKey: st.id,
        index: st.index,
        className: 'YEAR 5A',
        attendance: enrollments[existingEnrIdx].attendance || 64,
        enrolledTerms: studentEnrolledTerms,
      };
    } else {
      enrollments.push({
        id: `enr-2025-2026-5a-${st.id}`,
        studentId: st.id,
        studentKey: st.id,
        classId: '2025-2026-YEAR-5A',
        academicYear: '2025_2026',
        className: 'YEAR 5A',
        programme: 'PRIMARY',
        rollNumber: st.index,
        index: st.index,
        attendance: 64,
        enrolledTerms: studentEnrolledTerms,
        formTeacherId: 'demo-teacher-primary',
        subjectTeacherIds: [],
      });
    }
  }

  // 4. Normalize and deduplicate scores & summaries
  const scoreMap = new Map<string, AssessmentScore>();
  for (const s of snap.scores.filter((x) => !obsoleteClassIds.has(x.classId)).map(normalizeTermFields)) {
    const cleanStudentId = normalizeStudentIdToKey(s.studentId);
    const cleanScore: AssessmentScore = {
      ...s,
      studentId: cleanStudentId,
    };
    const key = `${cleanStudentId}|${cleanScore.subjectCode}|${cleanScore.mode}|${cleanScore.termKey}`;
    scoreMap.set(key, cleanScore);
  }

  for (const hs of [...HISTORICAL_YEAR5A_SCORES, ...HISTORICAL_YEAR6_SCORES, ...HISTORICAL_YEAR3_SCORES, ...HISTORICAL_YEAR1_SCORES, ...HISTORICAL_YEAR2_SCORES, ...HISTORICAL_YEAR7_SCORES]) {
    const cleanStudentId = normalizeStudentIdToKey(hs.studentId);
    const cleanScore: AssessmentScore = {
      ...hs,
      studentId: cleanStudentId,
    };
    const key = `${cleanStudentId}|${cleanScore.subjectCode}|${cleanScore.mode}|${cleanScore.termKey}`;
    if (!scoreMap.has(key)) {
      scoreMap.set(key, cleanScore);
    }
  }
  const scores = Array.from(scoreMap.values());

  const summaryMap = new Map<string, ReportSummary>();
  for (const s of snap.summaries.filter((x) => !obsoleteClassIds.has(x.classId)).map(normalizeTermFields)) {
    const cleanStudentId = normalizeStudentIdToKey(s.studentId);
    const cleanSum: ReportSummary = {
      ...s,
      studentId: cleanStudentId,
    };
    const key = `${cleanStudentId}|${cleanSum.academicYear}|${cleanSum.termKey}|${cleanSum.mode}`;
    summaryMap.set(key, cleanSum);
  }

  for (const hsum of [...HISTORICAL_YEAR5A_SUMMARIES, ...HISTORICAL_YEAR6_SUMMARIES, ...HISTORICAL_YEAR3_SUMMARIES, ...HISTORICAL_YEAR1_SUMMARIES, ...HISTORICAL_YEAR2_SUMMARIES, ...HISTORICAL_YEAR7_SUMMARIES]) {
    const cleanStudentId = normalizeStudentIdToKey(hsum.studentId);
    const cleanSum: ReportSummary = {
      ...hsum,
      studentId: cleanStudentId,
    };
    const key = `${cleanStudentId}|${cleanSum.academicYear}|${cleanSum.termKey}|${cleanSum.mode}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, cleanSum);
    }
  }
  const summaries = Array.from(summaryMap.values());

  return {
    ...snap,
    classes,
    lifelongStudents,
    enrollments,
    scores,
    summaries,
    keySeq: seq,
  };
}

export function demoSubjectLines(codes: { code: string; name: string; total: number }[]): SubjectLineSnapshot[] {
  return codes.map(({ code, name, total }) => ({
    code,
    name,
    totalScore: total,
    grade: gradeFromTotal(total),
  }));
}

export function buildDemoSnapshot(): {
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
      name: 'YEAR 5A',
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
      id: '2025-2026-YEAR-5A',
      name: 'YEAR 5A',
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
      settings: {
        ...DEFAULT_CLASS_SETTINGS(),
        teacherName: 'MR. HECTOR ARYIKU',
        termYearInfo: '2025/2026 — Term 3',
        reportDate: '25 July 2026',
        nextTermBegins: '8 September 2026',
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

  const primaryCls = classes[1] || classes[0];
  const primaryClassId = primaryCls.id;

  const enrollments: ClassEnrollment[] = [
    enrollmentFromClass(primaryCls, {
      id: 'enr-boateng-2324',
      studentId: 'life-boateng',
      studentKey: lifeBoateng.studentKey,
      classId: primaryClassId,
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
    enrollmentFromClass(primaryCls, {
      id: 'enr-mensah',
      studentId: 'life-mensah',
      studentKey: lifeMensah.studentKey,
      classId: primaryClassId,
      rollNumber: 'SAISDAN09A001',
      index: '001',
      attendance: 61,
      enrolledTerms: ALL_TERMS,
    }),
    enrollmentFromClass(primaryCls, {
      id: 'enr-darko',
      studentId: 'life-darko',
      studentKey: lifeDarko.studentKey,
      classId: primaryClassId,
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
