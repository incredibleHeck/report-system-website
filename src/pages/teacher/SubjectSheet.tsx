import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { parseAcademicYear } from '../../lib/academicYear';
import {
  getSubjectByCode,
  isAcademicSubject,
  isClubSubject,
  isNonAcademicSubject,
  AVAILABLE_CLUBS,
} from '../../lib/programmeSchemas';
import {
  calculateAcademicSubjectMarks,
  calculateNonAcademicSubjectMarks,
} from '../../lib/scoreCalculations';
import type { AssessmentScore, MtEntryMode } from '../../types';
import { Save, ArrowLeft, BookOpen, Plus } from 'lucide-react';

interface RowState {
  studentId: string;
  clubName: string;
  cw1: string;
  cw2: string;
  cw3: string;
  cw4: string;
  cw5: string;
  cwTotal: number;
  cwScaled: number;
  mt1: string;
  mt2: string;
  mt3: string;
  mtSingle: string;
  mtRaw: number;
  mtScaled: number;
  exam: string;
  examScaled: number;
  totalScore: number;
  grade: string;
  comment: string;
  rating: string;
}

export default function SubjectSheet() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { activeClass, classStudents } = useActiveClass();
  const { scores, upsertScores, subjectContexts, saveSubjectContext, updateStudent } =
    useDatabase();

  const [mode, setMode] = useState<'EOT' | 'MIDTERM'>('EOT');
  const [mtEntryMode, setMtEntryMode] = useState<MtEntryMode>('split');
  const [showCtxModal, setShowCtxModal] = useState(false);
  const [ctxGrade, setCtxGrade] = useState('');
  const [ctxTopics, setCtxTopics] = useState('');
  const [customClubs, setCustomClubs] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const subject = activeClass ? getSubjectByCode(activeClass.programme, code) : undefined;
  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : 'DEFAULT';

  const [adminEditOverride, setAdminEditOverride] = useState(false);

  const classYear = parseAcademicYear(activeClass?.settings.termYearInfo || '');
  const isCurrentActivePointer =
    (classYear === '2026/2027' || classYear === '2026-2027') &&
    activeClass?.settings.termYearInfo.includes('Term 1');

  const isArchivedTerm = !isCurrentActivePointer;
  const isTeacher = currentUser?.role === 'teacher';
  const isHeadteacher = currentUser?.role === 'headteacher';

  const isReadOnlyMode = isArchivedTerm && (isTeacher || !adminEditOverride);

  const isAcademic = subject ? isAcademicSubject(code, subject.kind) : true;
  const isClub = isClubSubject(code);
  const isNonAcademic = subject ? isNonAcademicSubject(code, subject.kind) : false;

  // Combine default available clubs with any dynamically added custom clubs
  const clubOptions = Array.from(new Set([...AVAILABLE_CLUBS, ...customClubs])).sort();

  // Load existing scores into local row state
  useEffect(() => {
    if (!activeClass || !subject) return;

    const nextRows: Record<string, RowState> = {};
    const extraClubs: string[] = [];

    for (const st of classStudents) {
      const hit = scores.find(
        (s) =>
          (s.classId === activeClass.id || (s as any).classStreamId === activeClass.id) &&
          s.subjectCode === code &&
          s.mode === mode &&
          (s.termKey === termKey || (s as any).termId === termKey) &&
          (s.studentId === st.id || s.studentKey === st.studentKey || s.studentId === st.studentKey || s.studentKey === st.id)
      );

      const studentClub = hit?.clubName || st.clubName || '';
      if (studentClub && !AVAILABLE_CLUBS.includes(studentClub)) {
        extraClubs.push(studentClub);
      }

      const cw1Val = hit?.cw1 !== undefined && hit?.cw1 !== null ? String(hit.cw1) : '';
      const cw2Val = hit?.cw2 !== undefined && hit?.cw2 !== null ? String(hit.cw2) : '';
      const cw3Val = hit?.cw3 !== undefined && hit?.cw3 !== null ? String(hit.cw3) : '';
      const cw4Val = hit?.cw4 !== undefined && hit?.cw4 !== null ? String(hit.cw4) : '';
      const cw5Val = hit?.cw5 !== undefined && hit?.cw5 !== null ? String(hit.cw5) : '';

      const mt1Val = hit?.mt1 !== undefined && hit?.mt1 !== null ? String(hit.mt1) : '';
      const mt2Val = hit?.mt2 !== undefined && hit?.mt2 !== null ? String(hit.mt2) : '';
      const mt3Val = hit?.mt3 !== undefined && hit?.mt3 !== null ? String(hit.mt3) : '';
      const mtSingleVal =
        hit?.mtSingle !== undefined && hit?.mtSingle !== null
          ? String(hit.mtSingle)
          : hit?.mtRaw !== undefined && hit?.mtRaw !== null
            ? String(hit.mtRaw)
            : '';

      const examVal =
        hit?.examRaw !== undefined && hit?.examRaw !== null
          ? String(hit.examRaw)
          : hit?.exam !== undefined && hit?.exam !== null
            ? String(hit.exam)
            : '';

      if (isAcademic) {
        const calc = calculateAcademicSubjectMarks({
          cw1: cw1Val ? Number(cw1Val) : null,
          cw2: cw2Val ? Number(cw2Val) : null,
          cw3: cw3Val ? Number(cw3Val) : null,
          cw4: cw4Val ? Number(cw4Val) : null,
          cw5: cw5Val ? Number(cw5Val) : null,
          mtEntryMode,
          mt1: mt1Val ? Number(mt1Val) : null,
          mt2: mt2Val ? Number(mt2Val) : null,
          mt3: mt3Val ? Number(mt3Val) : null,
          mtSingle: mtSingleVal ? Number(mtSingleVal) : null,
          exam: examVal ? Number(examVal) : null,
        });

        nextRows[st.id] = {
          studentId: st.id,
          clubName: studentClub,
          cw1: cw1Val,
          cw2: cw2Val,
          cw3: cw3Val,
          cw4: cw4Val,
          cw5: cw5Val,
          cwTotal: calc.cwTotal,
          cwScaled: calc.cwScaled,
          mt1: mt1Val,
          mt2: mt2Val,
          mt3: mt3Val,
          mtSingle: mtSingleVal,
          mtRaw: calc.mtRaw,
          mtScaled: calc.mtScaled,
          exam: examVal,
          examScaled: calc.examScaled,
          totalScore: hit?.totalScore ?? calc.totalScore,
          grade: hit?.grade || calc.grade,
          comment: hit?.comment || '',
          rating: String(hit?.totalScore ?? ''),
        };
      } else {
        const ratingVal =
          hit?.totalScore !== undefined && hit?.totalScore !== null ? String(hit.totalScore) : '';
        const calc = calculateNonAcademicSubjectMarks({
          rating: ratingVal ? Number(ratingVal) : null,
        });

        nextRows[st.id] = {
          studentId: st.id,
          clubName: studentClub,
          cw1: '',
          cw2: '',
          cw3: '',
          cw4: '',
          cw5: '',
          cwTotal: 0,
          cwScaled: 0,
          mt1: '',
          mt2: '',
          mt3: '',
          mtSingle: '',
          mtRaw: 0,
          mtScaled: 0,
          exam: '',
          examScaled: 0,
          totalScore: calc.totalScore,
          grade: calc.grade,
          comment: hit?.comment || '',
          rating: ratingVal,
        };
      }
    }

    if (extraClubs.length > 0) {
      setCustomClubs((prev) => Array.from(new Set([...prev, ...extraClubs])));
    }

    setRows(nextRows);

    const ctx = subjectContexts.find(
      (c) => c.classId === activeClass.id && c.subjectCode === code
    );
    setCtxGrade(ctx?.gradeBand || '');
    setCtxTopics(ctx?.topics.join(', ') || '');
  }, [
    activeClass?.id,
    code,
    mode,
    mtEntryMode,
    classStudents.length,
    scores.length,
    isAcademic,
    isClub,
    isNonAcademic,
  ]);

  const updateCell = useCallback(
    (studentId: string, field: keyof RowState, value: string) => {
      setRows((prev) => {
        const current = prev[studentId];
        if (!current) return prev;

        const updated = { ...current, [field]: value };

        if (isAcademic) {
          const calc = calculateAcademicSubjectMarks({
            cw1: updated.cw1 ? Number(updated.cw1) : null,
            cw2: updated.cw2 ? Number(updated.cw2) : null,
            cw3: updated.cw3 ? Number(updated.cw3) : null,
            cw4: updated.cw4 ? Number(updated.cw4) : null,
            cw5: updated.cw5 ? Number(updated.cw5) : null,
            mtEntryMode,
            mt1: updated.mt1 ? Number(updated.mt1) : null,
            mt2: updated.mt2 ? Number(updated.mt2) : null,
            mt3: updated.mt3 ? Number(updated.mt3) : null,
            mtSingle: updated.mtSingle ? Number(updated.mtSingle) : null,
            exam: updated.exam ? Number(updated.exam) : null,
          });

          updated.cwTotal = calc.cwTotal;
          updated.cwScaled = calc.cwScaled;
          updated.mtRaw = calc.mtRaw;
          updated.mtScaled = calc.mtScaled;
          updated.examScaled = calc.examScaled;
          updated.totalScore = calc.totalScore;
          updated.grade = calc.grade;
        } else if (field === 'rating') {
          const calc = calculateNonAcademicSubjectMarks({
            rating: value ? Number(value) : null,
          });
          updated.totalScore = calc.totalScore;
          updated.grade = calc.grade;
        }

        return { ...prev, [studentId]: updated };
      });
    },
    [isAcademic, mtEntryMode]
  );

  const handleAddCustomClub = () => {
    const input = prompt('Enter new custom club name:');
    if (!input || !input.trim()) return;
    const cleanName = input.trim();
    if (!clubOptions.includes(cleanName)) {
      setCustomClubs((prev) => [...prev, cleanName]);
    }
  };

  if (!activeClass || !subject) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <p className="text-slate-600 font-semibold">Subject not found for active class.</p>
        <button
          onClick={() => navigate('/teacher')}
          className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-red-800 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  const handleSaveAll = () => {
    if (isReadOnlyMode) {
      alert('Cannot save changes on read-only historical terms.');
      return;
    }
    const academicYear = parseAcademicYear(activeClass.settings.termYearInfo);

    const payload: Omit<AssessmentScore, 'id'>[] = classStudents.map((st) => {
      const r = rows[st.id];
      if (!r) {
        return {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: code,
          clubName: '',
          mode,
          termKey,
          academicYear,
          totalScore: 0,
          grade: 'U',
          comment: '',
        };
      }

      // Sync clubName to student record if on Club sheet
      if (isClub && r.clubName) {
        updateStudent(st.id, { clubName: r.clubName });
      }

      if (!isAcademic) {
        return {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: code,
          clubName: r.clubName || '',
          mode,
          termKey,
          academicYear,
          totalScore: r.totalScore,
          grade: r.grade,
          comment: r.comment,
        };
      }

      return {
        studentId: st.id,
        classId: activeClass.id,
        subjectCode: code,
        clubName: r.clubName || '',
        mode,
        termKey,
        academicYear,
        mtEntryMode,
        cw1: r.cw1 ? Number(r.cw1) : null,
        cw2: r.cw2 ? Number(r.cw2) : null,
        cw3: r.cw3 ? Number(r.cw3) : null,
        cw4: r.cw4 ? Number(r.cw4) : null,
        cw5: r.cw5 ? Number(r.cw5) : null,
        cwTotal: r.cwTotal,
        cwScaled: r.cwScaled,
        cwScore: r.cwScaled,
        mt1: r.mt1 ? Number(r.mt1) : null,
        mt2: r.mt2 ? Number(r.mt2) : null,
        mt3: r.mt3 ? Number(r.mt3) : null,
        mtSingle: r.mtSingle ? Number(r.mtSingle) : null,
        mtRaw: r.mtRaw,
        mtScaled: r.mtScaled,
        mtScore: r.mtScaled,
        examRaw: r.exam ? Number(r.exam) : null,
        examScaled: r.examScaled,
        eotScore: r.examScaled,
        totalScore: r.totalScore,
        grade: r.grade,
        comment: r.comment,
      };
    });

    upsertScores(payload);
    alert('Subject Sheet marks successfully saved!');
  };

  const handleSaveContext = () => {
    saveSubjectContext({
      classId: activeClass.id,
      subjectCode: code,
      gradeBand: ctxGrade,
      topics: ctxTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setShowCtxModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isClub ? 'CLUBS Assessment Sheet' : subject.name}
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-red-100 text-red-900">
              {isAcademic
                ? 'Pattern A: Academic'
                : isClub
                  ? 'Pattern C: Club Assessment'
                  : 'Pattern B: Non-Academic'}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            {activeClass.name} · Code: {subject.code} · Term: {termKey}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {isClub && (
            <button
              onClick={handleAddCustomClub}
              className="rounded-lg border border-slate-300 bg-white text-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all flex items-center gap-1.5"
              title="Add a custom club option to dropdown"
            >
              <Plus className="h-3.5 w-3.5 text-slate-600" />
              <span>Add Custom Club</span>
            </button>
          )}

          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'EOT' | 'MIDTERM')}
          >
            <option value="EOT">EOT Mode</option>
            <option value="MIDTERM">Midterm Mode</option>
          </select>

          {isAcademic && (
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all"
              value={mtEntryMode}
              onChange={(e) => setMtEntryMode(e.target.value as MtEntryMode)}
            >
              <option value="split">Midterm: Split (30+30+40)</option>
              <option value="single">Midterm: Single (/100)</option>
            </select>
          )}

          <button
            onClick={() => setShowCtxModal(true)}
            className="rounded-lg border border-slate-300 bg-white text-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all flex items-center gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5 text-slate-500" />
            <span>Context</span>
          </button>

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
            onClick={handleSaveAll}
            disabled={isReadOnlyMode}
            className="rounded-lg bg-red-800 text-white px-4 py-2 text-xs font-bold hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-2xs disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            <span>Save Marks</span>
          </button>
        </div>
      </div>

      {isReadOnlyMode && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-semibold flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <span>
              Historical Term Read-Only Lock: Viewing {termKey} (System Active Term: 2026/2027 Term 1). Score inputs are locked for teachers to prevent accidental overwrites.
            </span>
          </div>
          {isHeadteacher && (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">
              Headteacher Override Available
            </span>
          )}
        </div>
      )}

      {/* Main Score Grid */}
      <div className="overflow-x-auto rounded-lg shadow-xs border border-slate-200 bg-white max-h-[75vh] scrollbar-thin scrollbar-thumb-slate-300 min-w-[1350px]">
        <table className="min-w-[1350px] w-full text-xs border-collapse">
          <thead>
            {/* Header Group Banner */}
            <tr className="bg-red-900 text-white font-bold font-display uppercase tracking-wider text-center text-xs select-none sticky top-0 z-30 shadow-2xs">
              <th
                colSpan={isClub ? 3 : 2}
                className="py-2.5 px-3 border-r border-red-950/40 text-center sticky left-0 z-30 bg-red-950"
              >
                STUDENT PROFILE
              </th>
              {isAcademic ? (
                <>
                  <th colSpan={7} className="py-2.5 px-3 border-r border-red-950/40 text-center">
                    CLASS ASSESSMENT (20%)
                  </th>
                  <th
                    colSpan={mtEntryMode === 'split' ? 5 : 3}
                    className="py-2.5 px-3 border-r border-red-950/40 text-center"
                  >
                    MIDTERM ASSESSMENT (20%)
                  </th>
                  <th colSpan={2} className="py-2.5 px-3 border-r border-red-950/40 text-center">
                    EXAMINATION (60%)
                  </th>
                  <th colSpan={3} className="py-2.5 px-3 text-center">
                    TERM SUMMARY
                  </th>
                </>
              ) : (
                <th colSpan={3} className="py-2.5 px-3 text-center">
                  TERM SUMMARY
                </th>
              )}
            </tr>

            {/* Sub-Header Column Titles */}
            <tr className="bg-slate-100 font-semibold border-b border-r border-slate-300 text-slate-700 text-xs select-none sticky top-9 z-30">
              <th className="sticky left-0 z-30 bg-slate-100 text-left px-3 py-2 border-r border-b border-slate-300 w-14">
                Index No.
              </th>
              <th
                className={`sticky left-14 z-30 bg-slate-100 text-left px-3 py-2 border-b border-slate-300 w-52 min-w-[208px] ${
                  !isClub ? 'border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]' : 'border-r'
                }`}
              >
                Student Name
              </th>
              {isClub && (
                <th className="sticky left-[264px] z-30 bg-slate-100 text-left px-3 py-2 border-r-2 border-b border-slate-300 w-36 min-w-[144px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                  Club Name
                </th>
              )}

              {isAcademic ? (
                <>
                  <th className="w-14 text-center px-1 py-2 border-r border-b border-slate-200">CW 1</th>
                  <th className="w-14 text-center px-1 py-2 border-r border-b border-slate-200">CW 2</th>
                  <th className="w-14 text-center px-1 py-2 border-r border-b border-slate-200">CW 3</th>
                  <th className="w-14 text-center px-1 py-2 border-r border-b border-slate-200">CW 4</th>
                  <th className="w-14 text-center px-1 py-2 border-r border-b border-slate-200">CW 5</th>
                  <th className="w-20 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-800">
                    CW Total (50)
                  </th>
                  <th className="w-20 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900">
                    CW Scaled (20)
                  </th>

                  {mtEntryMode === 'split' ? (
                    <>
                      <th className="w-20 text-center px-1 py-2 border-r border-b border-slate-200">MT-TEST1 (30)</th>
                      <th className="w-20 text-center px-1 py-2 border-r border-b border-slate-200">MT-TEST2 (30)</th>
                      <th className="w-20 text-center px-1 py-2 border-r border-b border-slate-200">MT-TEST3 (40)</th>
                    </>
                  ) : (
                    <th className="w-20 text-center px-1 py-2 border-r border-b border-slate-200">MT-EXAMS (100)</th>
                  )}
                  <th className="w-20 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-800">
                    Midterm Raw (100)
                  </th>
                  <th className="w-20 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900">
                    Midterm Scaled (20)
                  </th>

                  <th className="w-20 text-center px-1 py-2 border-r border-b border-slate-200">Exam Score (100)</th>
                  <th className="w-20 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900">
                    Exam Scaled (60)
                  </th>

                  <th className="w-20 text-center bg-emerald-100/90 font-extrabold border-r border-b border-slate-300 text-emerald-950">
                    TOTAL SCORE (100)
                  </th>
                  <th className="w-16 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                    Grade
                  </th>
                  <th className="min-w-[280px] text-left px-3 py-2 border-b border-slate-300">
                    Teacher's Comment
                  </th>
                </>
              ) : (
                <>
                  <th className="w-24 text-center px-1 py-2 border-r border-b border-slate-200">RATINGS (100)</th>
                  <th className="w-16 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                    Grade
                  </th>
                  <th className="min-w-[320px] text-left px-3 py-2 border-b border-slate-300">
                    {isClub ? 'Club Comment' : "Teacher's Comment"}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {classStudents.map((st, idx) => {
              const r = rows[st.id] || {
                studentId: st.id,
                clubName: st.clubName || '',
                cw1: '',
                cw2: '',
                cw3: '',
                cw4: '',
                cw5: '',
                cwTotal: 0,
                cwScaled: 0,
                mt1: '',
                mt2: '',
                mt3: '',
                mtSingle: '',
                mtRaw: 0,
                mtScaled: 0,
                exam: '',
                examScaled: 0,
                totalScore: 0,
                grade: 'U',
                comment: '',
                rating: '',
              };

              return (
                <tr
                  key={st.id}
                  className="group/row border-t border-slate-200 hover:bg-red-50/30 transition-colors duration-150"
                >
                  {/* Sticky Index No. */}
                  <td className="px-3 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap align-middle sticky left-0 z-20 bg-white group-focus-within/row:bg-red-50/60 border-r border-b border-slate-300 w-14 transition-colors">
                    {st.index || String(idx + 1).padStart(3, '0')}
                  </td>

                  {/* Sticky Student Name (Clickable Transcript View) */}
                  <td
                    onClick={() => navigate(`/transcripts?studentKey=${st.studentKey || st.id}`)}
                    className={`px-3 py-2 font-semibold text-slate-900 whitespace-nowrap align-middle sticky left-14 z-20 bg-white group-focus-within/row:bg-red-50/60 border-b border-slate-300 w-52 transition-colors cursor-pointer hover:underline hover:text-red-700 ${
                      !isClub ? 'border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]' : 'border-r'
                    }`}
                    title="Click to view full student transcript"
                  >
                    {st.name}
                  </td>

                  {/* Sticky Club Selector for Pattern C */}
                  {isClub && (
                    <td className="px-2 py-1.5 align-middle sticky left-[264px] z-20 bg-white group-focus-within/row:bg-red-50/60 border-r-2 border-b border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] w-36 transition-colors">
                      <select
                        disabled={isReadOnlyMode}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all font-semibold disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        value={r.clubName}
                        onChange={(e) => updateCell(st.id, 'clubName', e.target.value)}
                      >
                        <option value="">-- Select Club --</option>
                        {clubOptions.map((club) => (
                          <option key={club} value={club}>
                            {club}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}

                  {isAcademic ? (
                    <>
                      {/* CW1..5 */}
                      {(['cw1', 'cw2', 'cw3', 'cw4', 'cw5'] as const).map((cwKey) => (
                        <td
                          key={cwKey}
                          className="px-1 py-1.5 text-center align-middle border-r border-b border-slate-200 w-14 focus-within:bg-red-50/40 transition-colors"
                        >
                          <input
                            type="number"
                            min={0}
                            max={10}
                            readOnly={isReadOnlyMode}
                            disabled={isReadOnlyMode}
                            className="w-12 text-center rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            value={r[cwKey]}
                            onChange={(e) => updateCell(st.id, cwKey, e.target.value)}
                          />
                        </td>
                      ))}

                      {/* CW Total & Scaled */}
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-slate-100/80 text-slate-800 border-r border-b border-slate-200 w-20">
                        {r.cwTotal}
                      </td>
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-950 border-r border-b border-slate-200 w-20">
                        {r.cwScaled}
                      </td>

                      {/* Midterm Entry */}
                      {mtEntryMode === 'split' ? (
                        <>
                          {(['mt1', 'mt2', 'mt3'] as const).map((mtKey, i) => (
                            <td
                              key={mtKey}
                              className="px-1 py-1.5 text-center align-middle border-r border-b border-slate-200 w-20 focus-within:bg-red-50/40 transition-colors"
                            >
                              <input
                                type="number"
                                min={0}
                                max={i === 2 ? 40 : 30}
                                readOnly={isReadOnlyMode}
                                disabled={isReadOnlyMode}
                                className="w-16 text-center rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                value={r[mtKey]}
                                onChange={(e) => updateCell(st.id, mtKey, e.target.value)}
                              />
                            </td>
                          ))}
                        </>
                      ) : (
                        <td className="px-1 py-1.5 text-center align-middle border-r border-b border-slate-200 w-20 focus-within:bg-red-50/40 transition-colors">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            readOnly={isReadOnlyMode}
                            disabled={isReadOnlyMode}
                            className="w-16 text-center rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            value={r.mtSingle}
                            onChange={(e) => updateCell(st.id, 'mtSingle', e.target.value)}
                          />
                        </td>
                      )}

                      {/* Midterm Raw & Scaled */}
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-slate-100/80 text-slate-800 border-r border-b border-slate-200 w-20">
                        {r.mtRaw}
                      </td>
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-950 border-r border-b border-slate-200 w-20">
                        {r.mtScaled}
                      </td>

                      {/* Exam Raw & Scaled */}
                      <td className="px-1 py-1.5 text-center align-middle border-r border-b border-slate-200 w-20 focus-within:bg-red-50/40 transition-colors">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          readOnly={isReadOnlyMode}
                          disabled={isReadOnlyMode}
                          className="w-16 text-center rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          value={r.exam}
                          onChange={(e) => updateCell(st.id, 'exam', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-950 border-r border-b border-slate-200 w-20">
                        {r.examScaled}
                      </td>

                      {/* Term Summary: Total Score, Grade, Comment */}
                      <td className="px-2 py-2 text-center align-middle font-mono font-extrabold bg-emerald-50 text-emerald-950 border-r border-b border-slate-200 w-20">
                        {r.totalScore}
                      </td>
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-200 w-16">
                        {r.grade}
                      </td>
                      <td className="px-3 py-1.5 align-middle border-b border-slate-200 min-w-[280px] focus-within:bg-red-50/40 transition-colors">
                        <input
                          type="text"
                          readOnly={isReadOnlyMode}
                          disabled={isReadOnlyMode}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          placeholder={isReadOnlyMode ? 'Locked historical term...' : 'Subject teacher comment...'}
                          value={r.comment}
                          onChange={(e) => updateCell(st.id, 'comment', e.target.value)}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Non-Academic & Club: Rating /100 */}
                      <td className="px-1 py-1.5 text-center align-middle border-r border-b border-slate-200 w-24 focus-within:bg-red-50/40 transition-colors">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          readOnly={isReadOnlyMode}
                          disabled={isReadOnlyMode}
                          className="w-20 text-center rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          value={r.rating}
                          onChange={(e) => updateCell(st.id, 'rating', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-200 w-16">
                        {r.grade}
                      </td>
                      <td className="px-3 py-1.5 align-middle border-b border-slate-200 min-w-[320px] focus-within:bg-red-50/40 transition-colors">
                        <input
                          type="text"
                          readOnly={isReadOnlyMode}
                          disabled={isReadOnlyMode}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          placeholder={isReadOnlyMode ? 'Locked historical term...' : isClub ? 'Club activity evaluation comment...' : 'Activity / Non-academic comment...'}
                          value={r.comment}
                          onChange={(e) => updateCell(st.id, 'comment', e.target.value)}
                        />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context Modal */}
      {showCtxModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-slate-950 text-slate-100 rounded-xl p-5 w-full max-w-md space-y-3 border border-slate-700">
            <h3 className="font-semibold text-amber-400">Set Subject Context</h3>
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
              placeholder="Grade band e.g. Year 5"
              value={ctxGrade}
              onChange={(e) => setCtxGrade(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white min-h-[100px]"
              placeholder="Topics covered (comma-separated)"
              value={ctxTopics}
              onChange={(e) => setCtxTopics(e.target.value)}
            />
            <p className="text-xs text-amber-400">
              {ctxTopics.split(',').filter((t) => t.trim()).length} topics specified
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCtxModal(false)}
                className="px-3 py-2 text-sm text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContext}
                className="px-3 py-2 text-sm rounded-lg bg-red-800 font-bold text-white"
              >
                Save Context
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
