import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useActiveClass, useDatabase, termKeyFromSettings, normalizeYearId } from '../context/DatabaseContext';
import {
  getSubjectsForProgramme,
  isAcademicSubject,
  isClubSubject,
  isNonAcademicSubject,
} from '../lib/programmeSchemas';
import { shouldIncludeProjectWork } from '../lib/term';
import { parseAcademicYear, toCanonicalTermKey } from '../lib/academicYear';
import { isTermKeyMatch } from '../lib/reportMath';
import { useAuth } from '../context/AuthContext';
import { calculateStreamOverviewAnalytics, formatOrdinalRank } from '../lib/scoreCalculations';
import type { AssessmentScore, ReportSummary, TermCode } from '../types';

export function useMasterSheetData() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClass, classStudents, academicYear, selectedAcademicYearId } = useActiveClass();
  const { scores, summaries, finalizeReports, updateStudent, upsertScores, users, systemSettings } = useDatabase();

  const [mode, setMode] = useState<'EOT' | 'MIDTERM'>('EOT');
  const [selectedTermView, setSelectedTermView] = useState<'T1' | 'T2' | 'T3' | 'ANNUAL'>('T1');
  const [generalComments, setGeneralComments] = useState<Record<string, string>>({});
  const [peComments, setPeComments] = useState<Record<string, string>>({});
  const [clubComments, setClubComments] = useState<Record<string, string>>({});

  // System active term pointer from class settings
  const currentTermYearInfo = activeClass?.settings.termYearInfo || '2026/2027 — Term 1';
  const [, activeTermPart] = currentTermYearInfo.split(' — ');
  const activeSystemTermCode: 'T1' | 'T2' | 'T3' =
    activeTermPart?.includes('Term 3') || activeTermPart?.includes('T3')
      ? 'T3'
      : activeTermPart?.includes('Term 2') || activeTermPart?.includes('T2')
        ? 'T2'
        : 'T1';

  const [adminEditOverride, setAdminEditOverride] = useState(false);

  const isCurrentActivePointer =
    (selectedAcademicYearId === '2026/2027' || selectedAcademicYearId === '2026-2027') &&
    selectedTermView === 'T1';

  const isArchivedTerm = !isCurrentActivePointer;
  const isAnnualView = selectedTermView === 'ANNUAL';

  const isTeacher = currentUser?.role === 'teacher';
  const isHeadteacher = currentUser?.role === 'headteacher';

  const normYearIdForLock = (selectedAcademicYearId || '2026/2027').replace('/', '-');
  const isTermLockedByAdmin = Boolean(
    systemSettings?.lockedTerms?.[`${normYearIdForLock}_${selectedTermView}`] ||
    systemSettings?.lockedTerms?.[`${selectedAcademicYearId}_${selectedTermView}`]
  );

  // Read-only lock guard: Teachers are read-only on archived terms, Annual view, or when locked by Headteacher.
  // Headteachers retain edit access or can toggle adminEditOverride.
  const isReadOnlyMode =
    isAnnualView ||
    (isArchivedTerm && (isTeacher || !adminEditOverride)) ||
    (isTermLockedByAdmin && isTeacher);

  // Derive term formats to handle existing/legacy score matches.
  // CRITICAL: Use the active class's own year for term key generation, not the
  // global selectedAcademicYearId. This fixes archived classes (e.g. 2025-2026-YEAR-5A)
  // that would otherwise generate wrong term keys like '2026-2027-T1' instead of '2025-2026-T1'.
  const year = academicYear || '';

  const fallbackYearId = systemSettings?.currentTermYearInfo 
    ? normalizeYearId(systemSettings.currentTermYearInfo.split(' ')[0]) 
    : '2026-2027';

  // classOwnYearId: prefer the year embedded in the active class's termYearInfo,
  // then fall back to selectedAcademicYearId, then the system fallback.
  const classOwnYearId = activeClass
    ? normalizeYearId(parseAcademicYear(activeClass.settings.termYearInfo).replace('_', '-'))
    : (normalizeYearId(selectedAcademicYearId) || fallbackYearId);

  const normYearId = classOwnYearId || normalizeYearId(selectedAcademicYearId) || fallbackYearId;
  const altYearId = normYearId.replace('-', '/');

  const getTermKeys = (tCode: string) => {
    return [toCanonicalTermKey(normYearId, tCode)];
  };

  const currentViewTermKeys = useMemo(() => {
    if (selectedTermView === 'ANNUAL') return [];
    return getTermKeys(selectedTermView);
  }, [selectedTermView, normYearId, altYearId, year]);

  const showProjectWorkForView = useMemo(() => {
    if (selectedTermView === 'T1' || selectedTermView === 'T2') return false;
    if (selectedTermView === 'T3' || selectedTermView === 'ANNUAL') return true;
    return shouldIncludeProjectWork(activeClass?.settings?.termYearInfo || '');
  }, [selectedTermView, activeClass?.settings?.termYearInfo]);

  const allSubjects = useMemo(() => {
    if (!activeClass) return [];
    const subjects = getSubjectsForProgramme(
      activeClass.programme,
      showProjectWorkForView
    );
    // Remove duplicate PE and CLUB subject column blocks from the Master Sheet grid (PE & Club comments are handled in the Form Teacher Remarks section)
    return subjects.filter(
      (s) => s.code !== 'PE' && s.code !== 'CLUB' && s.code !== 'CLUBS'
    );
  }, [activeClass, showProjectWorkForView]);

  const academicSubjects = useMemo(() => {
    return allSubjects.filter((s) => isAcademicSubject(s.code, s.kind));
  }, [allSubjects]);

  const userId = currentUser?.id || (currentUser as any)?.uid;
  const isFormTeacher = Boolean(
    activeClass &&
      userId &&
      (userId === activeClass.teacherId ||
        userId === (activeClass as any).formTeacherId ||
        userId === (activeClass as any).formTeacherUid ||
        isHeadteacher)
  );

  // Filter score documents for the active class and selected term view
  const currentClassScores = useMemo(() => {
    if (!activeClass) return [];
    return scores.filter((s) => {
      const matchClass =
        s.classId === activeClass.id ||
        (s as any).classStreamId === activeClass.id ||
        s.classId === activeClass.name ||
        (s as any).classStreamId === activeClass.name ||
        s.classId === '2025-2026-YEAR-5A' ||
        activeClass.id === '2025-2026-YEAR-5A';
      if (!matchClass) return false;
      if (mode && s.mode !== mode && s.mode !== undefined) return false;
      if (selectedTermView === 'ANNUAL') return true;
      return currentViewTermKeys.some((tk) => s.termKey === tk || (s as any).termId === tk);
    });
  }, [activeClass, scores, mode, selectedTermView, currentViewTermKeys]);

  // Published/Populated Terms Count for Annual Cumulative calculation
  const publishedTermCodes = useMemo(() => {
    if (!activeClass) return ['T1'];
    const codes = new Set<string>();
    for (const t of ['T1', 'T2', 'T3']) {
      const keys = getTermKeys(t);
      const hasScores = scores.some(
        (s) =>
          (s.classId === activeClass.id || (s as any).classStreamId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
          (mode ? (s.mode === mode || !s.mode) : true) &&
          keys.some((k) => s.termKey === k || (s as any).termId === k)
      );
      if (hasScores) codes.add(t);
    }
    return Array.from(codes).length > 0 ? Array.from(codes) : ['T1'];
  }, [activeClass, scores, mode, normYearId, altYearId, year]);

  // Compute Class Averages per subject
  const subjectAverages = useMemo(() => {
    if (!activeClass) return {};
    const avgs: Record<string, number> = {};
    for (const sub of allSubjects) {
      const subScores = currentClassScores.filter(
        (s) => s.subjectCode === sub.code && Number.isFinite(s.totalScore)
      );
      if (subScores.length > 0) {
        const sum = subScores.reduce((acc, curr) => acc + (curr.totalScore || 0), 0);
        avgs[sub.code] = Number((sum / subScores.length).toFixed(1));
      } else {
        avgs[sub.code] = 0;
      }
    }
    return avgs;
  }, [activeClass, allSubjects, currentClassScores]);

  // Load existing general, PE, and club comments
  useEffect(() => {
    if (!activeClass) return;
    const g: Record<string, string> = {};
    const p: Record<string, string> = {};
    const c: Record<string, string> = {};

    for (const st of classStudents) {
      const sum = summaries.find(
        (r) =>
          r.studentId === st.id &&
          (r.classId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
          (r.mode === mode || !r.mode) &&
          (selectedTermView === 'ANNUAL' || currentViewTermKeys.some((tk) => isTermKeyMatch(r.termKey, tk)))
      );
      g[st.id] = sum?.generalComment || '';
      p[st.id] = sum?.peComment || '';
      c[st.id] = sum?.clubComment || '';

      const peScore = currentClassScores.find(
        (x) =>
          (x.studentId === st.id || x.studentKey === st.studentKey) &&
          x.subjectCode === 'PE'
      );
      const clubScore = currentClassScores.find(
        (x) =>
          (x.studentId === st.id || x.studentKey === st.studentKey) &&
          (x.subjectCode === 'CLUB' || x.subjectCode === 'CLUBS')
      );

      if (peScore?.comment) p[st.id] = peScore.comment;
      if (clubScore?.comment) c[st.id] = clubScore.comment;
    }

    setGeneralComments(g);
    setPeComments(p);
    setClubComments(c);
  }, [activeClass?.id, mode, selectedTermView, currentViewTermKeys, classStudents.length, summaries.length, currentClassScores]);

  // Calculate stream-wide analytics (Raw Score, Average Score, Ave Grade, Ranks, Best/Least)
  const analyticsMap = useMemo(() => {
    if (!activeClass) return {};

    if (selectedTermView !== 'ANNUAL') {
      return calculateStreamOverviewAnalytics(classStudents, currentClassScores, academicSubjects);
    }

    // Annual Cumulative View: aggregate T1 Raw, T2 Raw, T3 Raw from the 3 term master sheets
    const map: Record<string, any> = {};

    for (const st of classStudents) {
      let t1Raw = 0;
      let t2Raw = 0;
      let t3Raw = 0;

      const sumT1 = summaries.find(
        (r) =>
          (r.studentId === st.id || r.studentId === st.studentKey) &&
          (r.classId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
          (r.mode === mode || !r.mode) &&
          (r.termKey.includes('T1') || r.termKey.endsWith('1'))
      );
      if (sumT1?.rawScore && sumT1.rawScore > 0) {
        t1Raw = sumT1.rawScore;
      } else {
        const t1Scores = scores.filter(
          (s) =>
            (s.studentId === st.id || s.studentKey === st.studentKey || s.studentId === st.studentKey) &&
            (s.classId === activeClass.id || (s as any).classStreamId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
            (s.mode === mode || !s.mode) &&
            (s.termKey.includes('T1') || (s as any).termId?.includes('T1')) &&
            academicSubjects.some((sub) => sub.code === s.subjectCode)
        );
        t1Raw = t1Scores.reduce((acc, s) => acc + (s.totalScore || 0), 0);
      }

      const sumT2 = summaries.find(
        (r) =>
          (r.studentId === st.id || r.studentId === st.studentKey) &&
          (r.classId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
          (r.mode === mode || !r.mode) &&
          (r.termKey.includes('T2') || r.termKey.endsWith('2'))
      );
      if (sumT2?.rawScore && sumT2.rawScore > 0) {
        t2Raw = sumT2.rawScore;
      } else {
        const t2Scores = scores.filter(
          (s) =>
            (s.studentId === st.id || s.studentKey === st.studentKey || s.studentId === st.studentKey) &&
            (s.classId === activeClass.id || (s as any).classStreamId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
            (s.mode === mode || !s.mode) &&
            (s.termKey.includes('T2') || (s as any).termId?.includes('T2')) &&
            academicSubjects.some((sub) => sub.code === s.subjectCode)
        );
        t2Raw = t2Scores.reduce((acc, s) => acc + (s.totalScore || 0), 0);
      }

      const sumT3 = summaries.find(
        (r) =>
          (r.studentId === st.id || r.studentId === st.studentKey) &&
          (r.classId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
          (r.mode === mode || !r.mode) &&
          (r.termKey.includes('T3') || r.termKey.endsWith('3'))
      );
      if (sumT3?.rawScore && sumT3.rawScore > 0) {
        t3Raw = sumT3.rawScore;
      } else {
        const t3Scores = scores.filter(
          (s) =>
            (s.studentId === st.id || s.studentKey === st.studentKey || s.studentId === st.studentKey) &&
            (s.classId === activeClass.id || (s as any).classStreamId === activeClass.id || activeClass.id === '2025-2026-YEAR-5A') &&
            (s.mode === mode || !s.mode) &&
            (s.termKey.includes('T3') || (s as any).termId?.includes('T3')) &&
            academicSubjects.some((sub) => sub.code === s.subjectCode)
        );
        t3Raw = t3Scores.reduce((acc, s) => acc + (s.totalScore || 0), 0);
      }

      const totalRaw = Number(((t1Raw ?? 0) + (t2Raw ?? 0) + (t3Raw ?? 0)).toFixed(1));
      let termsCount = 0;
      if (t1Raw > 0) termsCount++;
      if (t2Raw > 0) termsCount++;
      if (t3Raw > 0) termsCount++;
      if (termsCount === 0) termsCount = 1;

      const annualAverage = Number((totalRaw / (termsCount * (academicSubjects.length || 7))).toFixed(1));
      let aveGrade = 'U';
      if (annualAverage >= 80) aveGrade = 'A*';
      else if (annualAverage >= 70) aveGrade = 'A';
      else if (annualAverage >= 60) aveGrade = 'B';
      else if (annualAverage >= 50) aveGrade = 'C';
      else if (annualAverage >= 40) aveGrade = 'D';

      map[st.id] = {
        t1Raw: Number(t1Raw.toFixed(1)),
        t2Raw: Number(t2Raw.toFixed(1)),
        t3Raw: Number(t3Raw.toFixed(1)),
        rawScore: totalRaw,
        averageScore: annualAverage,
        aveGrade,
        bestMark: 0,
        bestGrade: 'A*',
        leastMark: 0,
        leastGrade: 'U',
        rank: 0,
        formattedRank: '-',
      };
    }

    // Sort students by raw score for annual rank calculation with standard ordinal tie handling (e.g. 1st, 1st, 3rd)
    const sorted = [...classStudents].sort((a, b) => (map[b.id]?.rawScore || 0) - (map[a.id]?.rawScore || 0));
    let currentRank = 1;
    sorted.forEach((st, idx) => {
      if (idx > 0 && (map[st.id]?.rawScore || 0) < (map[sorted[idx - 1].id]?.rawScore || 0)) {
        currentRank = idx + 1;
      }
      if (map[st.id]) {
        map[st.id].rank = currentRank;
        map[st.id].formattedRank = formatOrdinalRank(currentRank);
      }
    });

    return map;
  }, [activeClass, classStudents, scores, summaries, mode, selectedTermView, publishedTermCodes, academicSubjects]);

  const activeTermKey = `${normYearId}-${selectedTermView}`;

  const handleFinalize = () => {
    if (!activeClass) return;
    if (!isFormTeacher) {
      alert('Only the assigned Form Teacher can finalize the master sheet.');
      return;
    }
    if (isReadOnlyMode) {
      alert('Cannot finalize historical or annual sheets. Finalization is permitted only on the active term.');
      return;
    }

    const rowsToFinalize: Omit<ReportSummary, 'id'>[] = classStudents.map((st) => {
      const analytics = analyticsMap[st.id] || {
        rawScore: 0,
        averageScore: 0,
        aveGrade: 'U',
        bestMark: 0,
        bestGrade: 'U',
        leastMark: 0,
        leastGrade: 'U',
        rank: 0,
        formattedRank: '-',
      };

      const clubScore = currentClassScores.find(
        (x) =>
          (x.studentId === st.id || x.studentKey === st.studentKey) &&
          (x.subjectCode === 'CLUB' || x.subjectCode === 'CLUBS')
      );

      const assignedClub = st.clubName || clubScore?.clubName || '';

      return {
        studentId: st.id,
        studentKey: st.studentKey || st.id,
        classId: activeClass.id,
        clubName: assignedClub,
        mode,
        termKey: activeTermKey,
        academicYear: year,
        rawScore: analytics.rawScore,
        averageScore: analytics.averageScore,
        aveGrade: analytics.aveGrade,
        bestMark: analytics.bestMark,
        bestGrade: analytics.bestGrade,
        leastMark: analytics.leastMark,
        leastGrade: analytics.leastGrade,
        rank: analytics.rank,
        peComment: peComments[st.id] || '',
        clubComment: clubComments[st.id] || '',
        generalComment: generalComments[st.id] || '',
        teacherName: activeClass.settings.teacherName,
        className: activeClass.name,
        programme: activeClass.programme,
        finalized: true,
        subjectLines: allSubjects
          .filter((s) => isAcademicSubject(s.code, s.kind) || isNonAcademicSubject(s.code, s.kind))
          .map((sub) => {
            const hit = currentClassScores.find(
              (x) =>
                (x.studentId === st.id || x.studentKey === st.studentKey) &&
                x.subjectCode === sub.code
            );
            return {
              code: sub.code,
              name: sub.name,
              totalScore: hit?.totalScore ?? 0,
              grade: hit?.grade || 'U',
            };
          }),
      };
    });

    finalizeReports(rowsToFinalize);
    alert(`Finalized ${rowsToFinalize.length} ${mode} reports for ${activeClass.name} (${selectedTermView}).`);
  };

  return {
    navigate, currentUser, searchParams, setSearchParams,
    activeClass, classStudents, academicYear, selectedAcademicYearId,
    mode, setMode, selectedTermView, setSelectedTermView,
    generalComments, setGeneralComments, peComments, setPeComments, clubComments, setClubComments,
    adminEditOverride, setAdminEditOverride,
    isReadOnlyMode, isHeadteacher, isFormTeacher,
    allSubjects, academicSubjects, currentClassScores,
    publishedTermCodes, subjectAverages, analyticsMap,
    normYearId, activeTermKey, handleFinalize, isAnnualView
  };
}
