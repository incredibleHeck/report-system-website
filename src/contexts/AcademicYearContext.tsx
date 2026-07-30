import React, { createContext, useContext } from 'react';
import { School, User } from '../types';
import { createId } from '../data';
import { createAcademicYearWith3Terms } from '../lib/academicYearInit';

export interface AcademicYearState {
  schools: School[];
  setSchools: React.Dispatch<React.SetStateAction<School[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  systemSettings: any | null;
  setSystemSettings: React.Dispatch<React.SetStateAction<any | null>>;
  selectedAcademicYearId: string;
  setSelectedAcademicYearId: React.Dispatch<React.SetStateAction<string>>;
}

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('sais_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function useAcademicYearLogic(state: AcademicYearState) {
  const { schools, setSchools, users, setUsers, systemSettings, setSystemSettings, selectedAcademicYearId, setSelectedAcademicYearId } = state;

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

  const updateSystemSettings = (patch: Partial<any>) => {
    const user = getCurrentUser();
    if (user && user.role !== 'headteacher') {
      console.warn('Security Block: Non-headteacher attempted to modify system settings.');
      return;
    }
    state.setSystemSettings((prev: any) => ({ ...(prev || {}), ...patch }));
  };

  const toggleTermLock = (yearKey: string, termCode: string) => {
    const user = getCurrentUser();
    if (user && user.role !== 'headteacher') {
      console.warn('Security Block: Non-headteacher attempted to toggle term lock.');
      return;
    }
    const normKey = (yearKey || '').replace('/', '-').trim();
    const key = `${normKey}_${termCode}`;
    state.setSystemSettings((prev: any) => {
      const currentLocked = prev?.lockedTerms || {};
      return {
        ...(prev || {}),
        lockedTerms: {
          ...currentLocked,
          [key]: !currentLocked[key],
        },
      };
    });
  };

  const createAcademicYear = (year: string, status: 'active' | 'upcoming' = 'upcoming') =>
    createAcademicYearWith3Terms(year, status);

  return {
    schools,
    users,
    systemSettings,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    registerSchool,
    updateSchool,
    addTeacher,
    updateUser,
    updateSystemSettings,
    toggleTermLock,
    createAcademicYear,
  };
}

export type AcademicYearContextType = ReturnType<typeof useAcademicYearLogic>;
export const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (!context) throw new Error('useAcademicYear must be used within AcademicYearProvider');
  return context;
}
