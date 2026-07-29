import React, { createContext, useContext, useMemo } from 'react';
import { ClassStream, ClassSettings, Programme, ClassEnrollment } from '../types';
import { createId } from '../data';
import { DEFAULT_CLASS_SETTINGS } from '../types';
import { normalizeYearId, getStreamYearId } from './utils';
import { parseAcademicYear } from '../lib/academicYear';

export interface ClassStreamState {
  classes: ClassStream[];
  setClasses: React.Dispatch<React.SetStateAction<ClassStream[]>>;
  activeClassId: string | null;
  setActiveClassId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedAcademicYearId: string;
  setEnrollments: React.Dispatch<React.SetStateAction<ClassEnrollment[]>>;
}

export function useClassStreamLogic(state: ClassStreamState) {
  const { classes, setClasses, activeClassId, setActiveClassId, selectedAcademicYearId, setEnrollments } = state;

  const filteredClassStreams = useMemo(() => {
    const normSelected = normalizeYearId(selectedAcademicYearId);
    return classes.filter(
      (cs) => normalizeYearId(getStreamYearId(cs)) === normSelected
    );
  }, [classes, selectedAcademicYearId]);

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
      academicYearId: selectedAcademicYearId,
      academicYear: selectedAcademicYearId.replace('-', '/'),
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

  return {
    classes,
    activeClassId,
    setActiveClassId,
    filteredClassStreams,
    availableStreams: filteredClassStreams,
    createClass,
    updateClassSettings,
    assignSubjectTeacher,
    setFormTeacher,
  };
}

export type ClassStreamContextType = ReturnType<typeof useClassStreamLogic>;
export const ClassStreamContext = createContext<ClassStreamContextType | undefined>(undefined);

export function useClassStream() {
  const context = useContext(ClassStreamContext);
  if (!context) throw new Error('useClassStream must be used within ClassStreamProvider');
  return context;
}
