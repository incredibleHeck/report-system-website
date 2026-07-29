import { User, ClassStream, ClassSettings, LifelongStudent, ClassEnrollment, Student, AssessmentScore, ReportSummary, TermCode, SubjectLineSnapshot, School, Contact, SubjectContext, BannedTokenLedger, Programme, ReportMode } from '../types';
import { parseAcademicYear, buildTermKey, parseTermKey, formatStudentKey, yearStartFromAcademicYear, termsThroughLast, ALL_TERMS } from '../lib/academicYear';
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
  const parsed = parseTermKey(item.termKey);
  const termCode = parsed.termCode ?? 'T3';
  return {
    ...item,
    academicYear: item.academicYear || parsed.academicYear,
    termKey: buildTermKey(item.academicYear || parsed.academicYear, termCode),
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
  const year = String(yearJoined);
  const next = (keySeq[year] ?? 0) + 1;
  return {
    studentKey: formatStudentKey(yearJoined, next),
    seq: { ...keySeq, [year]: next },
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
