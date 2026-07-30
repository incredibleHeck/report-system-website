export type Programme = 'PRIMARY' | 'LOWER_SECONDARY' | 'UPPER_SECONDARY';
export type TermCode = 'T1' | 'T2' | 'T3';
export type SubjectKind = 'scored' | 'scoreOnly' | 'commentOnly';

export interface School {
  id: string;
  name: string;
  address?: string;
  website?: string;
  email?: string;
  tel?: string;
  motto?: string;
  logoUrl?: string;
  principalSignature?: string;
  headteacherId: string;
}

export interface AcademicYearDoc {
  id: string;
  academicYear: string;
  name: string;
  status: 'active' | 'upcoming' | 'completed' | 'archived';
  isArchived?: boolean;
  createdAt: string;
}

export interface AcademicTermDoc {
  id: string;
  academicYearId: string;
  academicYear: string;
  termCode: TermCode;
  termNumber: number;
  termName: string;
  status: 'active' | 'upcoming' | 'completed';
  startDate?: string;
  endDate?: string;
  createdAt: string;
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
  academicYearId?: string;
  academicYear?: string;
}

/** @deprecated alias kept for gradual migration */
export type ClassRoom = ClassStream;

export interface SubjectDefinition {
  code: string;
  name: string;
  kind: SubjectKind;
  abbr: string;
}

export interface SubjectContext {
  classId: string;
  subjectCode: string;
  gradeBand: string;
  topics: string[];
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
