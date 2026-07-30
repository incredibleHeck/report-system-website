import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { 
  School, User, ClassStream, LifelongStudent, ClassEnrollment, Student, AssessmentScore, 
  ReportSummary, Contact, SubjectContext, BannedTokenLedger, Programme, ReportMode, TermCode, SubjectLineSnapshot, DEFAULT_CLASS_SETTINGS
} from '../types';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { parseAcademicYear, yearStartFromAcademicYear, termsThroughLast, ALL_TERMS } from '../lib/academicYear';
import { KEYS, createId, localRepository, SaisSnapshot } from '../data';
import { FirestoreRepository } from '../data/FirestoreRepository';
import { ensureBaselineAcademicYears } from '../lib/academicYearInit';

import { useAcademicYearLogic, AcademicYearContext } from './AcademicYearContext';
import { useClassStreamLogic, ClassStreamContext } from './ClassStreamContext';
import { useStudentRegistryLogic, StudentRegistryContext } from './StudentRegistryContext';
import { useMarkGradingLogic, MarkGradingContext } from './MarkGradingContext';
import { deduplicateUsersByEmail, mintStudentKey, enrollmentFromClass, normalizeTermFields, gradeFromTotal, applyLegacyMigration, demoSubjectLines, buildDemoSnapshot, REAL_YEAR5A_STUDENTS } from './utils';

const activeRepository = import.meta.env.VITE_DATA_BACKEND === 'firestore' && import.meta.env.VITE_FIREBASE_API_KEY
  ? new FirestoreRepository()
  : localRepository;

export function RootDatabaseProvider({ children }: { children: ReactNode }) {
  const [dbReady, setDbReady] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('2026/2027');

  const [classes, setClasses] = useState<ClassStream[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const [lifelongStudents, setLifelongStudents] = useState<LifelongStudent[]>([]);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [bannedTokens, setBannedTokens] = useState<BannedTokenLedger[]>([]);
  const [keySeq, setKeySeq] = useState<Record<string, number>>({});

  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [subjectContexts, setSubjectContexts] = useState<SubjectContext[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => {};

    const clearData = () => {
      setSchools([]); setUsers([]); setClasses([]); setLifelongStudents([]);
      setEnrollments([]); setScores([]); setSummaries([]); setContacts([]);
      setSubjectContexts([]); setBannedTokens([]); setActiveClassId(null);
      setKeySeq({}); setDbReady(false); setDbLoading(false);
    };

    const loadData = async () => {
      setDbLoading(true);
      try {
        const loaded = await activeRepository.loadAll();
        const migrated = applyLegacyMigration(loaded);
        if (cancelled) return;
        setSchools(migrated.schools);
        setUsers(deduplicateUsersByEmail(migrated.users));
        setClasses(migrated.classes);
        setLifelongStudents(migrated.lifelongStudents);
        setEnrollments(migrated.enrollments);
        setScores(migrated.scores);
        setSummaries(migrated.summaries);
        setContacts(migrated.contacts);
        setSubjectContexts(migrated.subjectContexts);
        setBannedTokens(migrated.bannedTokens);
        setSystemSettings(migrated.systemSettings || null);
        setActiveClassId(migrated.activeClassId);
        setKeySeq(migrated.keySeq);
        await activeRepository.replaceAll(migrated);
        if (cancelled) return;
        setDbReady(true);
        void ensureBaselineAcademicYears();
      } catch (err) {
        console.error("Error loading data from repository, using demo snapshot fallback:", err);
        const fallbackSnap = applyLegacyMigration(buildDemoSnapshot());
        if (cancelled) return;
        setSchools(fallbackSnap.schools);
        setUsers(deduplicateUsersByEmail(fallbackSnap.users));
        setClasses(fallbackSnap.classes);
        setLifelongStudents(fallbackSnap.lifelongStudents);
        setEnrollments(fallbackSnap.enrollments);
        setScores(fallbackSnap.scores);
        setSummaries(fallbackSnap.summaries);
        setContacts(fallbackSnap.contacts);
        setSubjectContexts(fallbackSnap.subjectContexts);
        setBannedTokens(fallbackSnap.bannedTokens);
        setSystemSettings(null);
        setActiveClassId(fallbackSnap.activeClassId);
        setKeySeq(fallbackSnap.keySeq);
        setDbReady(true);
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    };

    if (import.meta.env.VITE_DATA_BACKEND === 'firestore') {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) loadData(); else { if (cancelled) return; clearData(); }
      });
    } else {
      loadData();
    }

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  function useSaveEffect<T>(collectionName: any, data: T, ready: boolean) {
    const isInitialRender = useRef(true);
    useEffect(() => {
      if (!ready) return;
      if (isInitialRender.current) { isInitialRender.current = false; return; }
      activeRepository.saveCollection(collectionName, data).catch((err) => {
        console.error(`Failed to save collection ${collectionName}:`, err);
        window.alert(
          'CRITICAL: Network sync failed. Your recent changes were not saved to the database. Please check your internet connection and refresh the page.'
        );
      });
    }, [data, ready, collectionName]);
  }

  useSaveEffect('schools', schools, dbReady);
  useSaveEffect('users', users, dbReady);
  useSaveEffect('classes', classes, dbReady);
  useSaveEffect('lifelongStudents', lifelongStudents, dbReady);
  useSaveEffect('enrollments', enrollments, dbReady);
  useSaveEffect('scores', scores, dbReady);
  useSaveEffect('summaries', summaries, dbReady);
  useSaveEffect('contacts', contacts, dbReady);
  useSaveEffect('subjectContexts', subjectContexts, dbReady);
  useSaveEffect('bannedTokens', bannedTokens, dbReady);
  useSaveEffect('systemSettings', systemSettings, dbReady);
  useSaveEffect('activeClassId', activeClassId, dbReady);
  useSaveEffect('keySeq', keySeq, dbReady);

  const academicYearLogic = useAcademicYearLogic({
    schools, setSchools, users, setUsers, systemSettings, setSystemSettings, selectedAcademicYearId, setSelectedAcademicYearId
  });

  const classStreamLogic = useClassStreamLogic({
    classes, setClasses, activeClassId, setActiveClassId, selectedAcademicYearId, setEnrollments
  });

  useEffect(() => {
    if (!classStreamLogic.filteredClassStreams.length) return;
    const currentBelongs = classStreamLogic.filteredClassStreams.some((cs) => cs.id === activeClassId);
    if (!currentBelongs) {
      const normSelected = selectedAcademicYearId.replace('/', '-').trim();
      const targetId = `${normSelected}-YEAR-5A`;
      const year5AStream = classStreamLogic.filteredClassStreams.find(
        (cs) => cs.id === targetId || cs.id.endsWith('YEAR-5A') || cs.name.includes('YEAR 5A')
      );
      const nextStreamId = year5AStream ? year5AStream.id : classStreamLogic.filteredClassStreams[0].id;
      setActiveClassId(nextStreamId);
    }
  }, [selectedAcademicYearId, classStreamLogic.filteredClassStreams, activeClassId]);

  const studentRegistryLogic = useStudentRegistryLogic({
    lifelongStudents, setLifelongStudents, enrollments, setEnrollments, contacts, setContacts, bannedTokens, setBannedTokens, keySeq, setKeySeq, classes
  });

  const markGradingLogic = useMarkGradingLogic({
    scores, setScores, summaries, setSummaries, subjectContexts, setSubjectContexts, classes, systemSettings
  });

  const seedDemoData = () => {
    const demo = buildDemoSnapshot();
    setSchools(demo.schools);
    setUsers(demo.users);
    setClasses(demo.classes);
    setLifelongStudents(demo.lifelongStudents);
    setEnrollments(demo.enrollments);
    setScores(demo.scores);
    setSummaries(demo.summaries);
    setContacts(demo.contacts);
    setSubjectContexts(demo.subjectContexts);
    setBannedTokens(demo.bannedTokens);
    setSystemSettings(null);
    setActiveClassId(demo.activeClassId);
    setKeySeq(demo.keySeq);
    void activeRepository.replaceAll({
      schools: demo.schools,
      users: demo.users,
      classes: demo.classes,
      lifelongStudents: demo.lifelongStudents,
      enrollments: demo.enrollments,
      scores: demo.scores,
      summaries: demo.summaries,
      contacts: demo.contacts,
      subjectContexts: demo.subjectContexts,
      bannedTokens: demo.bannedTokens,
      activeClassId: demo.activeClassId,
      keySeq: demo.keySeq,
    });
  };

  const clearAllData = () => {
    setSchools([]); setUsers([]); setClasses([]); setLifelongStudents([]);
    setEnrollments([]); setScores([]); setSummaries([]); setContacts([]);
    setSubjectContexts([]); setBannedTokens([]); setSystemSettings(null);
    setActiveClassId(null); setKeySeq({});
    void activeRepository.clearAll();
  };

  const compositeValue = {
    dbReady, dbLoading,
    ...academicYearLogic,
    ...classStreamLogic,
    ...studentRegistryLogic,
    ...markGradingLogic,
    seedDemoData,
    clearAllData,
  };

  if (dbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sais-cream text-sais-muted text-sm">
        Loading school data…
      </div>
    );
  }

  return (
    <RootCompositeContext.Provider value={compositeValue}>
      <AcademicYearContext.Provider value={academicYearLogic}>
        <ClassStreamContext.Provider value={classStreamLogic}>
          <StudentRegistryContext.Provider value={studentRegistryLogic}>
            <MarkGradingContext.Provider value={markGradingLogic}>
              {children}
            </MarkGradingContext.Provider>
          </StudentRegistryContext.Provider>
        </ClassStreamContext.Provider>
      </AcademicYearContext.Provider>
    </RootCompositeContext.Provider>
  );
}

export const RootCompositeContext = createContext<any>(undefined);

export function useDatabase() {
  const context = useContext(RootCompositeContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a RootDatabaseProvider');
  }
  return context;
}

export function useActiveClass() {
  const db = useDatabase();
  const {
    classes,
    activeClassId,
    setActiveClassId,
    students,
    enrollments,
    lifelongStudents,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    filteredClassStreams,
    availableStreams,
  } = db;
  
  const activeClass =
    classes.find((c: any) => c.id === activeClassId) ||
    filteredClassStreams[0] ||
    classes[0] ||
    null;
  const academicYear = activeClass
    ? parseAcademicYear(activeClass.settings.termYearInfo)
    : '';

  const classStudents = useMemo(() => {
    if (!activeClass) return [];

    const map = new Map<string, Student>();

    // 1. Direct students matching activeClass.id
    students
      .filter((s: any) => s.classId === activeClass.id || s.currentClassStreamId === activeClass.id)
      .forEach((s: any) => map.set(s.studentKey || s.id, s));

    // 2. Class enrollments matching activeClass.id
    enrollments
      .filter((e: any) => e.classId === activeClass.id)
      .forEach((e: any) => {
        const key = e.studentKey || e.studentId;
        if (!map.has(key)) {
          const l = lifelongStudents.find((ls: any) => ls.studentKey === e.studentKey || ls.id === e.studentId);
          map.set(key, {
            id: e.studentId,
            studentKey: e.studentKey || key,
            studentId: e.rollNumber || e.studentId,
            name: l?.name || e.studentId,
            gender: l?.gender || 'Male',
            index: e.index || '001',
            classId: activeClass.id,
            academicYear: activeClass.academicYear || academicYear,
            attendance: e.attendance || 60,
            schoolId: activeClass.schoolId || 'sais-school-main',
            status: l?.status || 'active',
            yearJoined: 2025,
            enrolledTerms: e.enrolledTerms || ['T1', 'T2', 'T3'],
          });
        }
      });

    if (map.size === 0 && activeClass.id === '2025-2026-YEAR-5A') {
      REAL_YEAR5A_STUDENTS.forEach((st) => {
        map.set(st.id, {
          id: st.id,
          studentKey: st.id,
          studentId: st.id,
          name: st.name,
          gender: st.gender,
          index: st.index,
          classId: activeClass.id,
          academicYear: activeClass.academicYear || academicYear,
          attendance: 60,
          schoolId: activeClass.schoolId || 'sais-school-main',
          status: 'active',
          yearJoined: 2025,
          enrolledTerms: st.enrolledTerms || ['T1', 'T2', 'T3'],
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const numA = parseInt(a.index, 10) || 0;
      const numB = parseInt(b.index, 10) || 0;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [students, enrollments, lifelongStudents, activeClass, academicYear]);

  return {
    activeClass,
    activeClassId: activeClass?.id ?? null,
    selectedClassStreamId: activeClass?.id ?? null,
    setActiveClassId,
    classes,
    filteredClassStreams,
    availableStreams,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    classStudents,
    academicYear,
  };
}
