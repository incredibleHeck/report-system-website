import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useActiveClass, useDatabase, termKeyFromSettings, normalizeYearId } from '../../context/DatabaseContext';
import {
  getSubjectsForProgramme,
  isAcademicSubject,
  isClubSubject,
  isNonAcademicSubject,
} from '../../lib/programmeSchemas';
import { shouldIncludeProjectWork } from '../../lib/term';
import { parseAcademicYear } from '../../lib/academicYear';
import { useAuth } from '../../context/AuthContext';
import { calculateStreamOverviewAnalytics } from '../../lib/scoreCalculations';
import type { AssessmentScore, ReportSummary, TermCode } from '../../types';
import { CheckCircle, AlertTriangle, Lock, Eye, Calendar, Layers } from 'lucide-react';

export default function MasterSheet() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClass, classStudents, academicYear, selectedAcademicYearId } = useActiveClass();
  const { scores, summaries, finalizeReports, updateStudent, upsertScores } = useDatabase();

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

  // Read-only lock guard: Teachers are read-only on all archived terms (before 2026/2027 Term 1) & Annual view.
  // Headteachers retain edit access or can toggle adminEditOverride.
  const isReadOnlyMode = isAnnualView || (isArchivedTerm && (isTeacher || !adminEditOverride));

  const year =
    academicYear || (activeClass ? parseAcademicYear(activeClass.settings.termYearInfo) : '');

  const normYearId = normalizeYearId(selectedAcademicYearId) || '2026-2027';
  const altYearId = normYearId.replace('-', '/');

  // Term keys lookup helper matching both hyphenated and slashed key formats in Firestore
  const getTermKeys = (tCode: string) => {
    const tNum = tCode.replace('T', '');
    return [
      `${normYearId}-T${tNum}`,
      `${normYearId}_T${tNum}`,
      `${altYearId}_T${tNum}`,
      `${altYearId}-T${tNum}`,
      `${normYearId}-${tCode}`,
      `${altYearId}_${tCode}`,
      `${year}_${tCode}`,
      `${normYearId}_${tCode}`,
      `${selectedAcademicYearId}-T${tNum}`,
      `${selectedAcademicYearId.replace('-', '/')}_T${tNum}`,
      `${selectedAcademicYearId.replace('/', '-')}-T${tNum}`,
    ];
  };

  const currentViewTermKeys = useMemo(() => {
    if (selectedTermView === 'ANNUAL') return [];
    return getTermKeys(selectedTermView);
  }, [selectedTermView, normYearId, altYearId, year]);

  const allSubjects = useMemo(() => {
    if (!activeClass) return [];
    return getSubjectsForProgramme(
      activeClass.programme,
      shouldIncludeProjectWork(activeClass.settings.termYearInfo)
    );
  }, [activeClass]);

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
        (s as any).classStreamId === activeClass.name;
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
          (s.classId === activeClass.id || (s as any).classStreamId === activeClass.id) &&
          (mode ? s.mode === mode : true) &&
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
        (s) =>
          s.classId === activeClass.id &&
          s.mode === mode &&
          (s.studentId === st.id || s.studentKey === st.studentKey || s.studentId === st.studentKey) &&
          (selectedTermView === 'ANNUAL' || currentViewTermKeys.some((tk) => s.termKey === tk))
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

    // Dynamic Annual Cumulative Average Calculation over published terms only
    const map: Record<string, any> = {};
    const publishedCount = publishedTermCodes.length || 1;

    for (const st of classStudents) {
      let rawSum = 0;
      let subjectCount = 0;

      for (const sub of academicSubjects) {
        let subSum = 0;
        let subTermCount = 0;
        for (const tCode of publishedTermCodes) {
          const tKeys = getTermKeys(tCode);
          const hit = scores.find(
            (s) =>
              s.classId === activeClass.id &&
              s.mode === mode &&
              (s.studentKey === st.studentKey || s.studentKey === st.id || s.studentId === st.id || s.studentId === st.studentKey) &&
              s.subjectCode === sub.code &&
              tKeys.some((k) => s.termKey === k || (s as any).termId === k)
          );
          if (hit && Number.isFinite(hit.totalScore)) {
            subSum += hit.totalScore;
            subTermCount++;
          }
        }
        if (subTermCount > 0) {
          const subAvg = Number((subSum / subTermCount).toFixed(1));
          rawSum += subAvg;
          subjectCount++;
        }
      }

      const annualAverage = subjectCount > 0 ? Number((rawSum / subjectCount).toFixed(1)) : 0;
      let aveGrade = 'U';
      if (annualAverage >= 80) aveGrade = 'A*';
      else if (annualAverage >= 70) aveGrade = 'A';
      else if (annualAverage >= 60) aveGrade = 'B';
      else if (annualAverage >= 50) aveGrade = 'C';
      else if (annualAverage >= 40) aveGrade = 'D';

      map[st.id] = {
        rawScore: Number(rawSum.toFixed(1)),
        averageScore: annualAverage,
        aveGrade,
        bestMark: 0,
        bestGrade: 'A',
        leastMark: 0,
        leastGrade: 'U',
        rank: 0,
      };
    }

    // Sort students by raw score for annual rank calculation
    const sorted = [...classStudents].sort((a, b) => (map[b.id]?.rawScore || 0) - (map[a.id]?.rawScore || 0));
    sorted.forEach((st, idx) => {
      if (map[st.id]) {
        map[st.id].rank = idx + 1;
      }
    });

    return map;
  }, [activeClass, classStudents, scores, mode, selectedTermView, publishedTermCodes, academicSubjects]);

  if (!activeClass) {
    return <p className="text-slate-500 font-medium p-4">No active class stream selected.</p>;
  }

  const activeTermKey = `${normYearId}-${selectedTermView}`;

  const handleFinalize = () => {
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

  return (
    <div className="space-y-4 max-w-full">
      {/* Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Sheet</h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-red-100 text-red-900">
              {selectedTermView === 'ANNUAL' ? 'Annual Cumulative Overview' : `Term ${selectedTermView.slice(1)} Overview`}
            </span>
            {isReadOnlyMode && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Lock className="w-3 h-3" />
                Read-Only Term Lock
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            {activeClass.name} · Academic Year: {selectedAcademicYearId} · Form Teacher:{' '}
            {activeClass.settings.teacherName || 'Assigned Form Teacher'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Term Switcher Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setSelectedTermView('T1')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedTermView === 'T1'
                  ? 'bg-red-800 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Term 1
            </button>
            <button
              onClick={() => setSelectedTermView('T2')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedTermView === 'T2'
                  ? 'bg-red-800 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Term 2
            </button>
            <button
              onClick={() => setSelectedTermView('T3')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedTermView === 'T3'
                  ? 'bg-red-800 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Term 3
            </button>
            <button
              onClick={() => setSelectedTermView('ANNUAL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedTermView === 'ANNUAL'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Annual Cumulative
            </button>
          </div>

          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'EOT' | 'MIDTERM')}
          >
            <option value="EOT">EOT Report Mode</option>
            <option value="MIDTERM">Midterm Report Mode</option>
          </select>

          {isHeadteacher && isArchivedTerm && (
            <button
              onClick={() => setAdminEditOverride(!adminEditOverride)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-all shadow-2xs border ${
                adminEditOverride
                  ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                  : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
              }`}
            >
              {adminEditOverride ? 'Admin Edit Mode Enabled' : 'Enable Edit Mode (Admin)'}
            </button>
          )}

          <button
            onClick={handleFinalize}
            disabled={!isFormTeacher || isReadOnlyMode}
            className="rounded-lg bg-red-800 text-white px-4 py-2 text-xs font-bold hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-2xs disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Finalize Stream Reports</span>
          </button>
        </div>
      </div>

      {isReadOnlyMode && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-semibold flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-700 flex-shrink-0" />
            <span>
              {selectedTermView === 'ANNUAL'
                ? 'Annual Cumulative Sheet is a read-only combined view calculated across published terms.'
                : `Historical Term Read-Only Lock: Viewing ${selectedAcademicYearId} ${selectedTermView} (System Active Term: 2026/2027 Term 1). Score inputs and remarks are locked for teachers.`}
            </span>
          </div>
          {isHeadteacher && (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">
              Headteacher Override Available
            </span>
          )}
        </div>
      )}

      {/* Main Consolidated Master Sheet Grid */}
      <div className="overflow-x-auto rounded-lg shadow-xs border border-slate-200 bg-white max-h-[75vh] scrollbar-thin scrollbar-thumb-slate-300 min-w-[2600px]">
        <table className="min-w-[2600px] w-full text-xs border-collapse">
          <thead>
            {/* Level 1 Category Banners */}
            <tr className="bg-red-900 text-white font-bold font-display uppercase tracking-wider text-center text-xs select-none sticky top-0 z-30 shadow-2xs">
              <th
                colSpan={4}
                className="py-2.5 px-3 border-r border-red-950/40 text-center sticky left-0 z-30 bg-red-950"
              >
                STUDENT IDENTIFIERS ({classStudents.length} Students)
              </th>
              {allSubjects.map((sub) => (
                <th
                  key={`group-${sub.code}`}
                  colSpan={isAcademicSubject(sub.code, sub.kind) ? 7 : 4}
                  className="py-2.5 px-3 border-r border-red-950/40 text-center"
                >
                  {sub.name} ({sub.code})
                </th>
              ))}
              <th colSpan={9} className="py-2.5 px-3 border-r border-red-950/40 text-center">
                STREAM SUMMARY & ANALYTICS ({selectedTermView === 'ANNUAL' ? `Averaged over ${publishedTermCodes.length} published terms` : selectedTermView})
              </th>
              <th colSpan={4} className="py-2.5 px-3 text-center">
                FORM TEACHER REMARKS & OVERALL COMMENTS
              </th>
            </tr>

            {/* Level 2 Sub-Header Columns */}
            <tr className="bg-slate-100 font-semibold border-b border-r border-slate-300 text-slate-700 text-xs select-none sticky top-9 z-30">
              {/* Sticky Identifiers */}
              <th className="sticky left-0 z-30 bg-slate-100 text-left px-2 py-2 border-r border-b border-slate-300 w-14">
                Index No.
              </th>
              <th className="sticky left-14 z-30 bg-slate-100 text-left px-2 py-2 border-r border-b border-slate-300 w-32">
                Student ID
              </th>
              <th className="sticky left-[184px] z-30 bg-slate-100 text-left px-3 py-2 border-r border-b border-slate-300 w-52 min-w-[208px]">
                Student Name
              </th>
              <th className="sticky left-[392px] z-30 bg-slate-100 text-left px-3 py-2 border-r-2 border-b border-slate-300 w-36 min-w-[144px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                Assigned Club
              </th>

              {/* Per-Subject Columns */}
              {allSubjects.map((sub) => {
                const isAcad = isAcademicSubject(sub.code, sub.kind);
                return (
                  <tr key={`cols-${sub.code}`} className="contents">
                    {isAcad ? (
                      <>
                        <th className="w-16 text-center px-1 py-2 border-r border-b border-slate-200">
                          {sub.abbr} CW 20
                        </th>
                        <th className="w-16 text-center px-1 py-2 border-r border-b border-slate-200">
                          {sub.abbr} MT 20
                        </th>
                        <th className="w-16 text-center px-1 py-2 border-r border-b border-slate-200">
                          {sub.abbr} EOT 60
                        </th>
                        <th className="w-20 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} {selectedTermView === 'ANNUAL' ? 'ANNUAL AVE' : 'EOT 100'}
                        </th>
                        <th className="w-16 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} GRADE
                        </th>
                        <th className="min-w-[160px] text-left px-2 py-2 border-r border-b border-slate-200">
                          {sub.abbr} COMMENT
                        </th>
                        <th
                          className="w-16 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
                          title={`Class Average: ${subjectAverages[sub.code] || 0}`}
                        >
                          {sub.abbr} AVE
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="w-20 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} EOT 100
                        </th>
                        <th className="w-16 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} GRADE
                        </th>
                        <th className="min-w-[180px] text-left px-2 py-2 border-r border-b border-slate-200">
                          {sub.abbr} COMMENT
                        </th>
                        <th
                          className="w-16 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
                          title={`Class Average: ${subjectAverages[sub.code] || 0}`}
                        >
                          {sub.abbr} AVE
                        </th>
                      </>
                    )}
                  </tr>
                );
              })}

              {/* Analytics Columns */}
              <th className="w-20 text-center bg-red-900 text-white font-bold border-r border-b border-red-950/40">
                RAW SCORE
              </th>
              <th className="w-24 text-center bg-amber-100/90 text-amber-950 font-bold border-r border-b border-slate-300">
                AVERAGE SCORE
              </th>
              <th className="w-16 text-center bg-slate-200/80 text-slate-900 font-bold border-r border-b border-slate-300">
                AVE GRADE
              </th>
              <th className="w-20 text-center border-r border-b border-slate-200">BEST MARK</th>
              <th className="w-16 text-center border-r border-b border-slate-200">BEST GRADE</th>
              <th className="w-20 text-center border-r border-b border-slate-200">LEAST MARK</th>
              <th className="w-16 text-center border-r border-b border-slate-200">LEAST GRADE</th>
              <th className="w-20 text-center border-r border-b border-slate-200">ATTENDANCE</th>
              <th className="w-16 text-center bg-red-900 text-white font-extrabold border-r border-b border-red-950/40">
                RANK
              </th>

              {/* Form Teacher Comments */}
              <th className="min-w-[280px] text-left px-3 py-2 border-r border-b border-slate-300">
                CLASS TEACHER'S COMMENT
              </th>
              <th className="min-w-[220px] text-left px-3 py-2 border-r border-b border-slate-300">
                PE COMMENT
              </th>
              <th className="min-w-[220px] text-left px-3 py-2 border-r border-b border-slate-300">
                CLUB COMMENT
              </th>
              <th className="w-44 text-left px-3 py-2 border-b border-slate-300">
                CLASS TEACHER’S NAME
              </th>
            </tr>
          </thead>

          <tbody>
            {classStudents.map((st, idx) => {
              const analytics = analyticsMap[st.id] || {
                rawScore: 0,
                averageScore: 0,
                aveGrade: 'U',
                bestMark: 0,
                bestGrade: 'U',
                leastMark: 0,
                leastGrade: 'U',
                rank: 0,
              };

              const clubScore = currentClassScores.find(
                (x) =>
                  (x.studentId === st.id || x.studentKey === st.studentKey || x.studentId === st.studentKey) &&
                  (x.subjectCode === 'CLUB' || x.subjectCode === 'CLUBS')
              );
              const assignedClub = st.clubName || clubScore?.clubName || 'Unassigned';

              return (
                <tr
                  key={st.id}
                  className="group/row border-t border-slate-200 hover:bg-red-50/30 transition-colors duration-150"
                >
                  {/* Sticky Index No. */}
                  <td className="px-2 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap align-middle sticky left-0 z-20 bg-white group-focus-within/row:bg-red-50/60 border-r border-b border-slate-300 w-14 transition-colors">
                    {st.index || String(idx + 1).padStart(3, '0')}
                  </td>

                  {/* Sticky Student ID */}
                  <td className="px-2 py-2 font-mono font-semibold text-slate-600 whitespace-nowrap align-middle sticky left-14 z-20 bg-white group-focus-within/row:bg-red-50/60 border-r border-b border-slate-300 w-32 transition-colors">
                    {st.studentKey || st.studentId || st.id}
                  </td>

                  {/* Sticky Student Name (Clickable Transcript View) */}
                  <td
                    onClick={() => navigate(`/transcripts?studentKey=${st.studentKey || st.id}`)}
                    className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap align-middle sticky left-[184px] z-20 bg-white group-focus-within/row:bg-red-50/60 border-r border-b border-slate-300 w-52 transition-colors cursor-pointer hover:underline hover:text-red-700"
                    title="Click to view full student transcript"
                  >
                    {st.name}
                  </td>

                  {/* Sticky Assigned Club */}
                  <td className="px-3 py-2 font-semibold text-red-900 bg-red-50/40 whitespace-nowrap align-middle sticky left-[392px] z-20 group-focus-within/row:bg-red-100/60 border-r-2 border-b border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] w-36 transition-colors">
                    {assignedClub}
                  </td>

                  {/* Per-Subject Blocks */}
                  {allSubjects.map((sub) => {
                    const isAcad = isAcademicSubject(sub.code, sub.kind);
                    const hit = currentClassScores.find(
                      (x) =>
                        (x.studentKey === st.studentKey ||
                          x.studentKey === st.id ||
                          x.studentId === st.id ||
                          x.studentId === st.studentKey ||
                          (x as any).legacyStudentId === st.studentId ||
                          (x as any).legacyStudentId === st.id) &&
                        x.subjectCode === sub.code
                    );

                    const cwScaled = hit?.cwScaled ?? hit?.cwScore ?? '—';
                    const mtScaled = hit?.mtScaled ?? hit?.mtScore ?? '—';
                    const eotScaled = hit?.examScaled ?? hit?.eotScore ?? '—';
                    const totalScore = hit?.totalScore ?? '—';
                    const grade = hit?.grade || '—';
                    const comment = hit?.comment || '';
                    const ave = subjectAverages[sub.code] || 0;

                    return (
                      <tr key={`cell-${sub.code}`} className="contents">
                        {isAcad ? (
                          <>
                            <td className="px-1 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
                              {cwScaled}
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
                              {mtScaled}
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
                              {eotScaled}
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-20">
                              {totalScore}
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-16">
                              {grade}
                            </td>
                            <td className="px-2 py-1.5 align-middle border-r border-b border-slate-200 min-w-[160px]">
                              <input
                                readOnly={isReadOnlyMode}
                                disabled={isReadOnlyMode}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                value={comment}
                                onChange={(e) => {
                                  if (isReadOnlyMode) return;
                                  const updatedComment = e.target.value;
                                  upsertScores([
                                    {
                                      studentId: st.id,
                                      studentKey: st.studentKey || st.id,
                                      classId: activeClass.id,
                                      subjectCode: sub.code,
                                      mode,
                                      termKey: activeTermKey,
                                      academicYear: year,
                                      totalScore: typeof totalScore === 'number' ? totalScore : 0,
                                      grade: grade !== '—' ? grade : 'U',
                                      comment: updatedComment,
                                    },
                                  ]);
                                }}
                                placeholder={isReadOnlyMode ? 'Locked...' : 'Remark...'}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-900 border-r border-b border-slate-300 w-16">
                              {ave}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-20">
                              {totalScore}
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-16">
                              {grade}
                            </td>
                            <td className="px-2 py-1.5 align-middle border-r border-b border-slate-200 min-w-[180px]">
                              <input
                                readOnly={isReadOnlyMode}
                                disabled={isReadOnlyMode}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                value={comment}
                                onChange={(e) => {
                                  if (isReadOnlyMode) return;
                                  const updatedComment = e.target.value;
                                  upsertScores([
                                    {
                                      studentId: st.id,
                                      studentKey: st.studentKey || st.id,
                                      classId: activeClass.id,
                                      subjectCode: sub.code,
                                      clubName: assignedClub !== 'Unassigned' ? assignedClub : '',
                                      mode,
                                      termKey: activeTermKey,
                                      academicYear: year,
                                      totalScore: typeof totalScore === 'number' ? totalScore : 0,
                                      grade: grade !== '—' ? grade : 'U',
                                      comment: updatedComment,
                                    },
                                  ]);
                                }}
                                placeholder={isReadOnlyMode ? 'Locked...' : 'Activity remark...'}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-900 border-r border-b border-slate-300 w-16">
                              {ave}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}

                  {/* Stream Analytics Totals */}
                  <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-red-950 text-white border-r border-b border-red-900 w-20">
                    {analytics.rawScore}
                  </td>
                  <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-100 text-amber-950 border-r border-b border-slate-300 w-24">
                    {analytics.averageScore}
                  </td>
                  <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-slate-200 text-slate-900 border-r border-b border-slate-300 w-16">
                    {analytics.aveGrade}
                  </td>
                  <td className="px-2 py-2 text-center align-middle font-mono font-semibold border-r border-b border-slate-200 w-20">
                    {analytics.bestMark}
                  </td>
                  <td className="px-2 py-2 text-center align-middle font-mono font-semibold border-r border-b border-slate-200 w-16">
                    {analytics.bestGrade}
                  </td>
                  <td className="px-2 py-2 text-center align-middle font-mono font-semibold border-r border-b border-slate-200 w-20">
                    {analytics.leastMark}
                  </td>
                  <td className="px-2 py-2 text-center align-middle font-mono font-semibold border-r border-b border-slate-200 w-16">
                    {analytics.leastGrade}
                  </td>

                  {/* Editable Attendance */}
                  <td className="px-1 py-1.5 text-center align-middle border-r border-b border-slate-200 w-20 focus-within:bg-red-50/40 transition-colors">
                    <input
                      disabled={isReadOnlyMode}
                      readOnly={isReadOnlyMode}
                      className="w-14 text-center rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      value={st.attendance ?? 64}
                      onChange={(e) => {
                        if (isReadOnlyMode) return;
                        updateStudent(st.id, { attendance: Number(e.target.value) || 0 });
                      }}
                    />
                  </td>

                  {/* Automated Rank */}
                  <td className="px-2 py-2 text-center align-middle font-mono font-extrabold bg-red-800 text-white border-r border-b border-red-900 w-16">
                    {analytics.rank}
                  </td>

                  {/* Form Teacher Comments & Remarks */}
                  <td className="px-3 py-1.5 align-middle border-r border-b border-slate-300 min-w-[280px] focus-within:bg-red-50/40 transition-colors">
                    <input
                      disabled={!isFormTeacher || isReadOnlyMode}
                      readOnly={isReadOnlyMode}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      value={generalComments[st.id] || ''}
                      onChange={(e) => {
                        if (isReadOnlyMode) return;
                        setGeneralComments((prev) => ({ ...prev, [st.id]: e.target.value }));
                      }}
                      placeholder={
                        isReadOnlyMode
                          ? 'Locked term view'
                          : isFormTeacher
                            ? 'Class teacher overall comment...'
                            : 'Locked for Form Teacher'
                      }
                    />
                  </td>

                  <td className="px-3 py-1.5 align-middle border-r border-b border-slate-300 min-w-[220px] focus-within:bg-red-50/40 transition-colors">
                    <input
                      disabled={!isFormTeacher || isReadOnlyMode}
                      readOnly={isReadOnlyMode}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      value={peComments[st.id] || ''}
                      onChange={(e) => {
                        if (isReadOnlyMode) return;
                        setPeComments((prev) => ({ ...prev, [st.id]: e.target.value }));
                      }}
                      placeholder={
                        isReadOnlyMode
                          ? 'Locked term view'
                          : isFormTeacher
                            ? 'PE evaluation comment...'
                            : 'Locked for Form Teacher'
                      }
                    />
                  </td>

                  <td className="px-3 py-1.5 align-middle border-r border-b border-slate-300 min-w-[220px] focus-within:bg-red-50/40 transition-colors">
                    <input
                      disabled={!isFormTeacher || isReadOnlyMode}
                      readOnly={isReadOnlyMode}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      value={clubComments[st.id] || ''}
                      onChange={(e) => {
                        if (isReadOnlyMode) return;
                        setClubComments((prev) => ({ ...prev, [st.id]: e.target.value }));
                      }}
                      placeholder={
                        isReadOnlyMode
                          ? 'Locked term view'
                          : isFormTeacher
                            ? 'Club activity comment...'
                            : 'Locked for Form Teacher'
                      }
                    />
                  </td>

                  <td className="px-3 py-2 text-xs font-semibold text-slate-800 align-middle border-b border-slate-300 w-44 truncate">
                    {activeClass.settings.teacherName || 'Form Teacher'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
