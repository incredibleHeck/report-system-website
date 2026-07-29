import React, { createContext, useContext, useMemo } from 'react';
import { LifelongStudent, ClassEnrollment, Contact, BannedTokenLedger, Student, ClassStream, TermCode } from '../types';
import { toStudentView, mintStudentKey, enrollmentFromClass } from './utils';
import { createId } from '../data';
import { parseAcademicYear, yearStartFromAcademicYear, termsThroughLast, ALL_TERMS } from '../lib/academicYear';

export interface StudentRegistryState {
  lifelongStudents: LifelongStudent[];
  setLifelongStudents: React.Dispatch<React.SetStateAction<LifelongStudent[]>>;
  enrollments: ClassEnrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<ClassEnrollment[]>>;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  bannedTokens: BannedTokenLedger[];
  setBannedTokens: React.Dispatch<React.SetStateAction<BannedTokenLedger[]>>;
  keySeq: Record<string, number>;
  setKeySeq: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  classes: ClassStream[];
}

export function useStudentRegistryLogic(state: StudentRegistryState) {
  const {
    lifelongStudents, setLifelongStudents,
    enrollments, setEnrollments,
    contacts, setContacts,
    bannedTokens, setBannedTokens,
    keySeq, setKeySeq,
    classes
  } = state;

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

    const yearJoined = input.yearJoined ?? yearStartFromAcademicYear(academicYear);

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

  return {
    lifelongStudents,
    enrollments,
    contacts,
    bannedTokens,
    students,
    addStudent,
    enrollExistingStudent,
    updateStudent,
    transferStudent,
    upsertContact,
    updateContactStatus,
    mergeBannedTokens,
  };
}

export type StudentRegistryContextType = ReturnType<typeof useStudentRegistryLogic>;
export const StudentRegistryContext = createContext<StudentRegistryContextType | undefined>(undefined);

export function useStudentRegistry() {
  const context = useContext(StudentRegistryContext);
  if (!context) throw new Error('useStudentRegistry must be used within StudentRegistryProvider');
  return context;
}
