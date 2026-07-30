import React, { createContext, useContext } from 'react';
import { AssessmentScore, ReportSummary, SubjectContext, ClassStream, ReportMode } from '../types';
import { normalizeTermFields, scoreKey, summaryKey } from './utils';
import { createId } from '../data';
import { parseAcademicYear, buildTermKey } from '../lib/academicYear';

export interface MarkGradingState {
  scores: AssessmentScore[];
  setScores: React.Dispatch<React.SetStateAction<AssessmentScore[]>>;
  summaries: ReportSummary[];
  setSummaries: React.Dispatch<React.SetStateAction<ReportSummary[]>>;
  subjectContexts: SubjectContext[];
  setSubjectContexts: React.Dispatch<React.SetStateAction<SubjectContext[]>>;
  classes: ClassStream[];
  systemSettings?: any;
  currentUser?: any;
}

const getCurrentUser = (stateUser?: any) => {
  if (stateUser) return stateUser;
  try {
    const raw = localStorage.getItem('sais_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const isTermLocked = (academicYear?: string, termKey?: string, systemSettings?: any) => {
  if (!systemSettings?.lockedTerms) return false;
  if (!academicYear && !termKey) return false;

  const rawYear = (academicYear || '').replace('/', '-').trim();
  const rawTerm = (termKey || '').trim();

  let termCode = 'T1';
  if (rawTerm.includes('T3') || rawTerm.includes('Term 3') || rawTerm.endsWith('3')) termCode = 'T3';
  else if (rawTerm.includes('T2') || rawTerm.includes('Term 2') || rawTerm.endsWith('2')) termCode = 'T2';

  const yearNorm = rawYear ? rawYear.split('-T')[0].split('_T')[0] : '2026-2027';
  const yearAlt = yearNorm.replace('-', '/');

  const key1 = `${yearNorm}_${termCode}`;
  const key2 = `${yearAlt}_${termCode}`;

  return Boolean(systemSettings.lockedTerms[key1] || systemSettings.lockedTerms[key2]);
};

export function useMarkGradingLogic(state: MarkGradingState) {
  const { scores, setScores, summaries, setSummaries, subjectContexts, setSubjectContexts, classes, systemSettings, currentUser } = state;

  const upsertScore = (score: Omit<AssessmentScore, 'id'>): boolean => {
    const normalized = normalizeTermFields(score);
    if (!normalized.academicYear) throw new Error('academicYear is required on scores');

    const user = getCurrentUser(currentUser);
    const isLocked = isTermLocked(normalized.academicYear, normalized.termKey, systemSettings);

    if (isLocked && user?.role !== 'headteacher') {
      console.warn('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
      return false;
    }

    setScores((prev) => {
      const key = scoreKey(normalized);
      const idx = prev.findIndex((p) => scoreKey(p) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...normalized };
        return next;
      }
      return [...prev, { ...normalized, id: createId() }];
    });
    return true;
  };

  const upsertScores = (list: Omit<AssessmentScore, 'id'>[]): boolean => {
    const user = getCurrentUser(currentUser);

    let hasSecurityBlock = false;
    const allowedList = list.filter((score) => {
      const normalized = normalizeTermFields(score);
      const isLocked = isTermLocked(normalized.academicYear, normalized.termKey, systemSettings);
      if (isLocked && user?.role !== 'headteacher') {
        console.warn('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
        hasSecurityBlock = true;
        return false;
      }
      return true;
    });

    if (allowedList.length === 0) return false;

    setScores((prev) => {
      const map = new Map<string, AssessmentScore>(prev.map((p) => [scoreKey(p), p]));
      for (const score of allowedList) {
        const normalized = normalizeTermFields(score);
        if (!normalized.academicYear) throw new Error('academicYear is required on scores');
        const key = scoreKey(normalized);
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...normalized, id: existing.id });
        } else {
          map.set(key, { ...normalized, id: createId() });
        }
      }
      return Array.from(map.values());
    });
    return !hasSecurityBlock;
  };

  const saveSummaries = (reports: Omit<ReportSummary, 'id'>[]): boolean => {
    const user = getCurrentUser(currentUser);

    let hasSecurityBlock = false;
    const allowedReports = reports.filter((report) => {
      const normalized = normalizeTermFields(report);
      const isLocked = isTermLocked(normalized.academicYear, normalized.termKey, systemSettings);
      if (isLocked && user?.role !== 'headteacher') {
        console.warn('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
        hasSecurityBlock = true;
        return false;
      }
      return true;
    });

    if (allowedReports.length === 0) return false;

    setSummaries((prev) => {
      const map = new Map<string, ReportSummary>(prev.map((p) => [summaryKey(p), p]));
      for (const report of allowedReports) {
        const normalized = normalizeTermFields(report);
        const key = summaryKey(normalized);
        const existing = map.get(key);
        map.set(key, {
          ...existing,
          ...normalized,
          id: existing?.id ?? createId(),
        });
      }
      return Array.from(map.values());
    });
    return !hasSecurityBlock;
  };

  const finalizeReports = (reportsOrClassId: Omit<ReportSummary, 'id'>[] | string) => {
    const user = getCurrentUser(currentUser);

    if (typeof reportsOrClassId === 'string') {
      const classId = reportsOrClassId;
      const targetClass = classes.find((c) => c.id === classId);
      const termInfo = targetClass?.settings?.termYearInfo || '2026/2027 — Term 1';
      const [yearPart, termPart] = termInfo.split(' — ');
      const isLocked = isTermLocked(yearPart, termPart, systemSettings);

      if (isLocked && user?.role !== 'headteacher') {
        console.warn('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
        return;
      }

      setSummaries((prev) => {
        const hasMatch = prev.some((s) => s.classId === classId);
        if (hasMatch) {
          return prev.map((s) => (s.classId === classId ? { ...s, finalized: true, isFinalized: true } : s));
        } else {
          const newSummary: ReportSummary = {
            id: createId(),
            classId,
            studentId: 'CLASS_SUMMARY',
            academicYear: yearPart || '2026/2027',
            termKey: termPart || 'T1',
            mode: 'EOT',
            finalized: true,
            isFinalized: true,
            rawScore: null,
            averageScore: null,
            aveGrade: null,
            bestMark: null,
            bestGrade: null,
            leastMark: null,
            leastGrade: null,
            rank: null,
            peComment: '',
            clubComment: '',
            generalComment: '',
            teacherName: '',
            className: '',
            programme: 'PRIMARY',
            subjectLines: [],
          };
          return [...prev, newSummary];
        }
      });
    } else {
      saveSummaries(
        reportsOrClassId.map((r) => ({
          ...r,
          finalized: true,
          isFinalized: true,
          subjectLines: r.subjectLines ?? [],
        }))
      );
    }
  };

  const unfinalizeReports = (classId: string) => {
    const user = getCurrentUser(currentUser);
    const targetClass = classes.find((c) => c.id === classId);
    const termInfo = targetClass?.settings?.termYearInfo || '2026/2027 — Term 1';
    const [yearPart, termPart] = termInfo.split(' — ');
    const isLocked = isTermLocked(yearPart, termPart, systemSettings);

    if (isLocked && user?.role !== 'headteacher') {
      console.warn('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
      return;
    }

    setSummaries((prev) =>
      prev.map((s) => (s.classId === classId ? { ...s, finalized: false, isFinalized: false } : s))
    );
  };

  const unfinalizeReport = (
    studentId: string,
    academicYear: string,
    termKey: string,
    mode: ReportMode = 'EOT'
  ) => {
    const user = getCurrentUser(currentUser);
    const isLocked = isTermLocked(academicYear, termKey, systemSettings);

    if (isLocked && user?.role !== 'headteacher') {
      console.warn('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
      return;
    }

    setSummaries((prev) =>
      prev.map((s) => {
        if (
          s.studentId !== studentId ||
          s.academicYear !== academicYear ||
          s.termKey !== termKey ||
          s.mode !== mode
        ) {
          return s;
        }
        return {
          ...s,
          finalized: false,
          isFinalized: false,
          subjectLines: null,
          rawScore: null,
          averageScore: null,
          aveGrade: null,
          bestMark: null,
          bestGrade: null,
          leastMark: null,
          leastGrade: null,
          rank: null,
        };
      })
    );
  };

  const replaceScores = (next: AssessmentScore[]) => setScores(next);
  const replaceSummaries = (next: ReportSummary[]) => setSummaries(next);

  const saveSubjectContext = (ctx: SubjectContext) => {
    setSubjectContexts((prev) => {
      const idx = prev.findIndex(
        (c) => c.classId === ctx.classId && c.subjectCode === ctx.subjectCode
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ctx;
        return next;
      }
      return [...prev, ctx];
    });
  };

  const saveSubjectResults = (
    result: Omit<AssessmentScore, 'id'> & { subjectName?: string }
  ) => {
    const { subjectName, ...rest } = result;
    const cls = classes.find((c) => c.id === rest.classId);
    const academicYear =
      rest.academicYear ??
      (cls ? parseAcademicYear(cls.settings.termYearInfo) : '2025_2026');
    upsertScore({
      ...rest,
      subjectCode: rest.subjectCode || subjectName || 'UNK',
      mode: rest.mode || 'EOT',
      termKey: rest.termKey || buildTermKey(academicYear, 'T3'),
      academicYear,
      classId: rest.classId || '',
    });
  };

  return {
    scores,
    summaries,
    subjectContexts,
    results: scores,
    finalReports: summaries,
    upsertScore,
    upsertScores,
    replaceScores,
    saveSummaries,
    replaceSummaries,
    finalizeReports,
    unfinalizeReports,
    unfinalizeReport,
    saveSubjectContext,
    saveSubjectResults,
    saveFinalReports: saveSummaries,
  };
}

export type MarkGradingContextType = ReturnType<typeof useMarkGradingLogic>;
export const MarkGradingContext = createContext<MarkGradingContextType | undefined>(undefined);

export function useMarkGrading() {
  const context = useContext(MarkGradingContext);
  if (!context) throw new Error('useMarkGrading must be used within MarkGradingProvider');
  return context;
}
