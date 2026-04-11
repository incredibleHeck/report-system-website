export interface School {
  id: string;
  name: string;
  headteacherId: string;
}

export interface User {
  id: string;
  name: string;
  role: 'headteacher' | 'teacher' | 'student';
  schoolId: string;
}

export interface SubjectAssignment {
  subjectName: string;
  teacherId: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  teacherId: string; // Form teacher
  schoolId: string;
  subjectTeachers?: SubjectAssignment[];
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  classId: string;
  schoolId: string;
}

export interface SubjectResult {
  id: string;
  studentId: string;
  subjectName: string;
  cwScore: number; // out of 20
  mtScore: number; // out of 20
  eotScore: number; // out of 60
  totalScore: number; // out of 100
  grade: string;
  comment: string;
}

export interface FinalReport {
  id: string;
  studentId: string;
  classId: string;
  rawScore: number;
  averageScore: number;
  rank: number;
  generalComment: string;
}
