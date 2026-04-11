import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { School, User, ClassRoom, Student, SubjectResult, FinalReport } from '../types';

interface DatabaseContextType {
  schools: School[];
  users: User[];
  classes: ClassRoom[];
  students: Student[];
  results: SubjectResult[];
  finalReports: FinalReport[];
  registerSchool: (school: Omit<School, 'id'>) => void;
  addTeacher: (teacher: Omit<User, 'id' | 'role'>) => void;
  createClass: (classRoom: Omit<ClassRoom, 'id'>) => void;
  assignSubjectTeacher: (classId: string, subjectName: string, teacherId: string) => void;
  addStudent: (student: Omit<Student, 'id'>) => void;
  saveSubjectResults: (result: Omit<SubjectResult, 'id'>) => void;
  saveFinalReports: (reports: Omit<FinalReport, 'id'>[]) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage or default to empty arrays
  const [schools, setSchools] = useState<School[]>(() => JSON.parse(localStorage.getItem('schools') || '[]'));
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('users') || '[]'));
  const [classes, setClasses] = useState<ClassRoom[]>(() => JSON.parse(localStorage.getItem('classes') || '[]'));
  const [students, setStudents] = useState<Student[]>(() => JSON.parse(localStorage.getItem('students') || '[]'));
  const [results, setResults] = useState<SubjectResult[]>(() => JSON.parse(localStorage.getItem('results') || '[]'));
  const [finalReports, setFinalReports] = useState<FinalReport[]>(() => JSON.parse(localStorage.getItem('finalReports') || '[]'));

  // Persist state changes to localStorage
  useEffect(() => { localStorage.setItem('schools', JSON.stringify(schools)); }, [schools]);
  useEffect(() => { localStorage.setItem('users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('classes', JSON.stringify(classes)); }, [classes]);
  useEffect(() => { localStorage.setItem('students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('results', JSON.stringify(results)); }, [results]);
  useEffect(() => { localStorage.setItem('finalReports', JSON.stringify(finalReports)); }, [finalReports]);

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const registerSchool = (school: Omit<School, 'id'>) => {
    setSchools(prev => [...prev, { ...school, id: generateId() }]);
  };

  const addTeacher = (teacher: Omit<User, 'id' | 'role'>) => {
    setUsers(prev => [...prev, { ...teacher, role: 'teacher', id: generateId() }]);
  };

  const createClass = (classRoom: Omit<ClassRoom, 'id'>) => {
    setClasses(prev => [...prev, { ...classRoom, id: generateId() }]);
  };

  const assignSubjectTeacher = (classId: string, subjectName: string, teacherId: string) => {
    setClasses(prev => prev.map(c => {
      if (c.id === classId) {
        const existing = c.subjectTeachers || [];
        const updated = [...existing.filter(st => st.subjectName !== subjectName), { subjectName, teacherId }];
        return { ...c, subjectTeachers: updated };
      }
      return c;
    }));
  };

  const addStudent = (student: Omit<Student, 'id'>) => {
    setStudents(prev => [...prev, { ...student, id: generateId() }]);
  };

  const saveSubjectResults = (result: Omit<SubjectResult, 'id'>) => {
    setResults(prev => [...prev, { ...result, id: generateId() }]);
  };

  const saveFinalReports = (reports: Omit<FinalReport, 'id'>[]) => {
    const studentIds = reports.map(r => r.studentId);
    setFinalReports(prev => [
      ...prev.filter(p => !studentIds.includes(p.studentId)), // Remove old reports for these students
      ...reports.map(r => ({ ...r, id: generateId() }))
    ]);
  };

  return (
    <DatabaseContext.Provider value={{
      schools,
      users,
      classes,
      students,
      results,
      finalReports,
      registerSchool,
      addTeacher,
      createClass,
      assignSubjectTeacher,
      addStudent,
      saveSubjectResults,
      saveFinalReports
    }}>
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
