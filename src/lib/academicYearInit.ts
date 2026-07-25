import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { AcademicYearDoc, AcademicTermDoc } from '../types';

export function getDeterministicYearId(academicYear: string): string {
  return academicYear.trim().replace(/\//g, '-');
}

export function getDeterministicTermId(academicYear: string, termCode: 'T1' | 'T2' | 'T3'): string {
  const yearId = getDeterministicYearId(academicYear);
  return `${yearId}-${termCode}`;
}

export async function ensureBaselineAcademicYears(): Promise<void> {
  if (!db) return;

  const baselineYears = [
    { year: '2026/2027', status: 'active' as const, isArchived: false },
    { year: '2025/2026', status: 'archived' as const, isArchived: true },
    { year: '2024/2025', status: 'archived' as const, isArchived: true },
    { year: '2023/2024', status: 'archived' as const, isArchived: true },
    { year: '2022/2023', status: 'archived' as const, isArchived: true },
    { year: '2021/2022', status: 'archived' as const, isArchived: true },
  ];

  const streamCodes = [
    { code: 'YEAR-1A', name: 'YEAR 1A' },
    { code: 'YEAR-1B', name: 'YEAR 1B' },
    { code: 'YEAR-2A', name: 'YEAR 2A' },
    { code: 'YEAR-2B', name: 'YEAR 2B' },
    { code: 'YEAR-3A', name: 'YEAR 3A' },
    { code: 'YEAR-3B', name: 'YEAR 3B' },
    { code: 'YEAR-4A', name: 'YEAR 4A' },
    { code: 'YEAR-4B', name: 'YEAR 4B' },
    { code: 'YEAR-5A', name: 'YEAR 5A' },
    { code: 'YEAR-5B', name: 'YEAR 5B' },
    { code: 'YEAR-6A', name: 'YEAR 6A' },
    { code: 'YEAR-6B', name: 'YEAR 6B' },
    { code: 'YEAR-7',  name: 'YEAR 7'  },
  ];

  try {
    const batch = writeBatch(db);

    for (const { year, status, isArchived } of baselineYears) {
      const yearId = getDeterministicYearId(year);
      const yearDocRef = doc(db, 'academicYears', yearId);
      const yearDoc: AcademicYearDoc = {
        id: yearId,
        academicYear: year,
        name: year,
        status,
        isArchived,
        createdAt: new Date().toISOString(),
      };
      batch.set(yearDocRef, yearDoc, { merge: true });

      const terms: ('T1' | 'T2' | 'T3')[] = ['T1', 'T2', 'T3'];
      terms.forEach((tCode, idx) => {
        const termId = getDeterministicTermId(year, tCode);
        const termRef = doc(db, 'terms', termId);
        const termNum = idx + 1;
        const termDoc: AcademicTermDoc = {
          id: termId,
          academicYearId: yearId,
          academicYear: year,
          termCode: tCode,
          termNumber: termNum,
          termName: `Term ${termNum}`,
          status: year === '2026/2027' ? (termNum === 1 ? 'active' : 'upcoming') : 'completed',
          createdAt: new Date().toISOString(),
        };
        batch.set(termRef, termDoc, { merge: true });
      });
    }

    // Set active systemSettings pointer doc
    const systemSettingsRef = doc(db, 'systemSettings', 'active');
    batch.set(systemSettingsRef, {
      activeAcademicYearId: '2026-2027',
      activeAcademicYear: '2026/2027',
      activeTermId: '2026-2027-T1',
      activeTermCode: 'T1',
      activeTermNumber: 1,
      activeTermName: 'Term 1',
      currentTermYearInfo: '2026/2027 — Term 1',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Provision 2026/2027 streams (all 13 streams)
    for (const s of streamCodes) {
      const classId = `2026-2027-${s.code}`;
      const csRef = doc(db, 'classStreams', classId);
      const scRef = doc(db, 'sais_classes', classId);
      const classData = {
        id: classId,
        name: s.name,
        academicYearId: '2026-2027',
        academicYear: '2026/2027',
        programme: s.code === 'YEAR-7' ? 'LOWER_SECONDARY' : 'PRIMARY',
        schoolId: 'sais-school-main',
        teacherId: 'demo-teacher-primary',
        subjectTeachers: [
          { subjectCode: 'ENG', teacherId: 'demo-teacher-primary' },
          { subjectCode: 'MATH', teacherId: 'demo-teacher-primary' },
          { subjectCode: 'SCI', teacherId: 'demo-teacher-primary' },
        ],
        settings: {
          termYearInfo: '2026/2027 — Term 1',
          teacherName: 'MR. HECTOR ARYIKU',
          attendanceTotal: 64,
          nameFormat: 'LAST_FIRST',
          showProjectWork: true,
        },
      };
      batch.set(csRef, classData, { merge: true });
      batch.set(scRef, classData, { merge: true });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Baseline year check or system settings provisioning failed:', err);
  }
}

export async function createAcademicYearWith3Terms(
  academicYear: string,
  status: 'active' | 'upcoming' = 'upcoming'
): Promise<string> {
  const yearId = getDeterministicYearId(academicYear);
  const yearDocRef = doc(db, 'academicYears', yearId);

  const yearDoc: AcademicYearDoc = {
    id: yearId,
    academicYear,
    name: academicYear,
    status,
    createdAt: new Date().toISOString(),
  };

  const batch = writeBatch(db);
  batch.set(yearDocRef, yearDoc);

  const terms: ('T1' | 'T2' | 'T3')[] = ['T1', 'T2', 'T3'];
  terms.forEach((tCode, idx) => {
    const termId = getDeterministicTermId(academicYear, tCode);
    const termRef = doc(db, 'terms', termId);
    const termNum = idx + 1;
    const termDoc: AcademicTermDoc = {
      id: termId,
      academicYearId: yearId,
      academicYear,
      termCode: tCode,
      termNumber: termNum,
      termName: `Term ${termNum}`,
      status: status === 'active' ? (termNum === 1 ? 'active' : 'upcoming') : 'upcoming',
      createdAt: new Date().toISOString(),
    };
    batch.set(termRef, termDoc);
  });

  await batch.commit();
  return yearId;
}
