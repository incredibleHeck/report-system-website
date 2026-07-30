import type { Programme, TermCode } from './class.types';

export type StudentStatus = 'active' | 'alumni' | 'transferred';

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: 'active' | 'inactive';
  role: 'headteacher' | 'teacher';
  schoolId: string;
  subjects?: string[];
  /** For student role: lifelong student UUID */
  linkedStudentId?: string;
  /** For student role: lifelong key (session-bound transcript) */
  studentKey?: string;
}

/** Lifelong identity — key never encodes class/year */
export interface LifelongStudent {
  id: string;
  studentKey: string;
  name: string;
  parentEmail?: string;
  parentWhatsApp?: string;
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
  clubName?: string;
}
