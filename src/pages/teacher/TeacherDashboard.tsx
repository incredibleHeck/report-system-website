import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Zap, UserPlus, Search, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass, useDatabase, normalizeYearId, getStreamYearId } from '../../context/DatabaseContext';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import { normalizeGender } from '../../lib/gender';
import { termsFromJoin } from '../../lib/academicYear';
import Modal from '../../components/ui/Modal';
import BulkStudentImportModal from '../../components/registry/BulkStudentImportModal';
import type { TermCode } from '../../types';

export default function TeacherDashboard() {
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const { currentUser } = useAuth();
  const {
    addStudent,
    enrollExistingStudent,
    transferStudent,
    users,
    updateClassSettings,
    lifelongStudents,
    enrollments,
  } = useDatabase();
  const {
    activeClass,
    classes,
    setActiveClassId,
    classStudents,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
  } = useActiveClass();
  const isHeadteacherRole = currentUser?.role === 'headteacher';

  const userClasses = isHeadteacherRole
    ? classes
    : (classes.filter(
        (c) =>
          c.teacherId === currentUser?.id ||
          c.subjectTeachers.some((st) => st.teacherId === currentUser?.id)
      ).length
        ? classes.filter(
            (c) =>
              c.teacherId === currentUser?.id ||
              c.subjectTeachers.some((st) => st.teacherId === currentUser?.id)
          )
        : classes);

  const displayStreams = userClasses.filter(
    (cs) => normalizeYearId(getStreamYearId(cs)) === normalizeYearId(selectedAcademicYearId)
  );

  const currentTermYearInfo = activeClass?.settings?.termYearInfo || '2026/2027 — Term 1';
  const [, termPart] = currentTermYearInfo.split(' — ');
  const selectedTerm = termPart || 'Term 1';

  const handleYearChange = (newYear: string) => {
    setSelectedAcademicYearId(newYear);
  };

  const handleTermChange = (newTerm: string) => {
    if (!activeClass) return;
    updateClassSettings(activeClass.id, { termYearInfo: `${selectedAcademicYearId} — ${newTerm}` });
  };

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Male');
  const [existingKey, setExistingKey] = useState('');
  const [existingSearchQuery, setExistingSearchQuery] = useState('');
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<any | null>(null);
  const [joinTerm, setJoinTerm] = useState<TermCode>('T1');
  const [error, setError] = useState('');

  // Promote / Roster Import Modal State
  const [promoteSourceClassId, setPromoteSourceClassId] = useState('');
  const [selectedPromoteKeys, setSelectedPromoteKeys] = useState<string[]>([]);

  // Transfer modal state
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
  const [transferTerm, setTransferTerm] = useState<TermCode>('T1');

  const computeNextIndex = () => {
    const maxIndex = classStudents.reduce((max, s) => {
      const parsed = parseInt(s.index || '0', 10);
      return !isNaN(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return String(maxIndex + 1).padStart(3, '0');
  };

  // Derive unenrolled students for quick selection in Enroll Existing
  const allUnenrolledStudents = useMemo(() => {
    if (!activeClass || !lifelongStudents) return [];
    const currentlyEnrolledKeys = new Set(classStudents.map((s) => s.studentKey || s.id));
    return (lifelongStudents || [])
      .filter((l: any) => !currentlyEnrolledKeys.has(l.studentKey) && !currentlyEnrolledKeys.has(l.id))
      .map((l: any) => {
        const prevEnr = (enrollments || []).find((e: any) => e.studentKey === l.studentKey && e.classId !== activeClass.id);
        const prevClass = prevEnr ? classes.find((c: any) => c.id === prevEnr.classId)?.name : null;
        return {
          ...l,
          prevClassLabel: prevClass ? ` (Prev: ${prevClass})` : '',
        };
      })
      .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [activeClass, lifelongStudents, classStudents, enrollments, classes]);

  // Matching candidate search hits (typing name or key)
  const matchingEnrollCandidates = useMemo(() => {
    if (!existingSearchQuery.trim()) return [];
    const q = existingSearchQuery.trim().toLowerCase();
    return allUnenrolledStudents
      .filter(
        (st: any) =>
          st.name.toLowerCase().includes(q) ||
          st.studentKey.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [allUnenrolledStudents, existingSearchQuery]);

  // Candidates for Fast-Promote Modal
  const availableSourceClasses = useMemo(() => {
    if (!activeClass) return [];
    return classes.filter((c) => c.id !== activeClass.id);
  }, [classes, activeClass]);

  const promoteCandidates = useMemo(() => {
    if (!promoteSourceClassId || !activeClass) return [];
    const currentlyEnrolledKeys = new Set(classStudents.map((s) => s.studentKey || s.id));
    const sourceEnrollments = (enrollments || []).filter((e) => e.classId === promoteSourceClassId);
    const lifeByKey = new Map<string, any>((lifelongStudents || []).map((l: any) => [l.studentKey, l]));

    return sourceEnrollments
      .map((en) => {
        const life = lifeByKey.get(en.studentKey) as { name?: string } | undefined;
        return {
          studentKey: en.studentKey,
          name: life?.name || en.studentKey,
          isEnrolledInTarget: currentlyEnrolledKeys.has(en.studentKey),
        };
      })
      .filter((st) => !st.isEnrolledInTarget);
  }, [promoteSourceClassId, enrollments, lifelongStudents, classStudents, activeClass]);

  const handleAddStudent = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!activeClass || !studentId.trim() || !name.trim()) return;
    const nextIndex = computeNextIndex();
    try {
      addStudent({
        studentId: studentId.trim().toUpperCase(),
        name: name.trim().toUpperCase(),
        gender: normalizeGender(gender),
        index: nextIndex,
        classId: activeClass.id,
        schoolId: activeClass.schoolId,
        attendance: activeClass.settings?.attendanceTotal ?? 60,
        enrolledTerms: termsFromJoin(joinTerm),
      });
      setStudentId('');
      setName('');
      setJoinTerm('T1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add student');
    }
  };

  const selectStudentForEnrollment = (st: any) => {
    setSelectedStudentToEnroll(st);
    setExistingKey(st.studentKey);
    setExistingSearchQuery(`${st.name} (${st.studentKey})`);
    if (!studentId) {
      setStudentId(`STU-${computeNextIndex()}`);
    }
  };

  const handleEnrollExisting = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const targetKey = existingKey.trim() || selectedStudentToEnroll?.studentKey;
    if (!activeClass || !targetKey || !studentId.trim()) return;
    const nextIndex = computeNextIndex();
    try {
      enrollExistingStudent({
        studentKey: targetKey.toUpperCase(),
        classId: activeClass.id,
        rollNumber: studentId.trim().toUpperCase(),
        index: nextIndex,
        enrolledTerms: termsFromJoin(joinTerm),
      });
      setExistingKey('');
      setExistingSearchQuery('');
      setSelectedStudentToEnroll(null);
      setStudentId('');
      setJoinTerm('T1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enroll student');
    }
  };

  const handleExecutePromoteRoster = (e: FormEvent) => {
    e.preventDefault();
    if (!activeClass || selectedPromoteKeys.length === 0) return;
    let count = 0;
    try {
      let currentIndexNum = parseInt(computeNextIndex(), 10);
      for (const key of selectedPromoteKeys) {
        const indexStr = String(currentIndexNum).padStart(3, '0');
        enrollExistingStudent({
          studentKey: key,
          classId: activeClass.id,
          rollNumber: `STU-${indexStr}`,
          index: indexStr,
          enrolledTerms: termsFromJoin('T1'),
        });
        currentIndexNum++;
        count++;
      }
      setIsPromoteModalOpen(false);
      setSelectedPromoteKeys([]);
      setPromoteSourceClassId('');
      alert(`Successfully enrolled ${count} existing student(s) into ${activeClass.name}!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to promote roster');
    }
  };

  const openTransferModal = (studentLifeId: string, studentName: string) => {
    setTransferTarget({ id: studentLifeId, name: studentName });
    setTransferTerm('T1');
  };

  const confirmTransfer = (e: FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    try {
      transferStudent(transferTarget.id, transferTerm);
      setTransferTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  if (!userClasses.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-sais-black font-display">No classes assigned</h1>
        <p className="text-sais-muted mt-2 text-sm">
          Ask the headteacher to create a class, or load demo data from the login screen.
        </p>
      </div>
    );
  }

  const subjects = activeClass
    ? getSubjectsForTerm(activeClass.programme, activeClass.settings?.termYearInfo || '2026/2027 — Term 1')
    : [];

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-sais-black font-display">Class Workspace</h1>
          <p className="text-sm text-sais-muted mt-1">
            Form teacher: <span className="font-semibold text-sais-black">{users.find((u) => u.id === activeClass?.teacherId)?.name || '—'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-sais-muted mb-1 font-medium">Academic Year</label>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red shadow-xs transition-all cursor-pointer"
              value={selectedAcademicYearId}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              <option value="2026/2027">2026/2027 (Active Pointer)</option>
              <option value="2025/2026">2025/2026 (Archived)</option>
              <option value="2024/2025">2024/2025 (Archived)</option>
              <option value="2023/2024">2023/2024 (Archived)</option>
              <option value="2022/2023">2022/2023 (Archived)</option>
              <option value="2021/2022">2021/2022 (Archived)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-sais-muted mb-1 font-medium">Active Class</label>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all min-w-[180px]"
              value={activeClass?.id || ''}
              onChange={(e) => setActiveClassId(e.target.value)}
            >
              {displayStreams.length === 0 ? (
                <option value="">No streams in {selectedAcademicYearId}</option>
              ) : (
                displayStreams.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.programme})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs text-sais-muted mb-1 font-medium">Term</label>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red shadow-xs transition-all"
              value={selectedTerm}
              onChange={(e) => handleTermChange(e.target.value)}
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>
        </div>
      </div>

      {activeClass && (
        <>
          {/* Sleek, Compact Class Banner (Replaces Oversized Cards) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="text-slate-400 font-normal">Programme:</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wider">{activeClass.programme}</span>
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="text-slate-400 font-normal">Enrolled Students:</span>
                <span className="font-bold text-red-900 bg-red-50 px-2.5 py-0.5 rounded border border-red-200 text-xs font-mono">{classStudents.length}</span>
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="text-slate-400 font-normal">Active Term:</span>
                <span className="font-semibold text-slate-900">{activeClass.settings.termYearInfo}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/teacher/mastersheet?classId=${activeClass.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-800 text-white px-3 py-1.5 text-xs font-bold hover:bg-red-900 transition-all shadow-2xs"
              >
                <span>📊 Open Master Sheet</span>
              </Link>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sais-black text-base font-display flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-red-800" />
                Subjects ({subjects.length})
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {subjects.map((sub) => (
                <Link
                  key={sub.code}
                  to={`/teacher/subjects/${sub.code}`}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-red-600 hover:shadow-md active:scale-[0.98] transition-all duration-200 flex flex-col justify-between space-y-2 group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono font-bold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {sub.code}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight bg-slate-100 px-1.5 py-0.5 rounded">
                      {sub.kind}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="font-bold text-slate-800 text-xs group-hover:text-red-800 transition-colors line-clamp-1">
                      {sub.name}
                    </p>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-700 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-sais-black text-lg font-display">Classlist ({classStudents.length})</h2>
                <p className="text-xs text-slate-500">Manage student class enrollment for {selectedAcademicYearId}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className={`px-3.5 py-1.5 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] ${
                    mode === 'new'
                      ? 'bg-sais-red text-sais-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-sais-black hover:bg-slate-200'
                  }`}
                  onClick={() => setMode('new')}
                >
                  Add new
                </button>
                <button
                  type="button"
                  className={`px-3.5 py-1.5 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] ${
                    mode === 'existing'
                      ? 'bg-sais-red text-sais-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-sais-black hover:bg-slate-200'
                  }`}
                  onClick={() => setMode('existing')}
                >
                  Enroll existing
                </button>
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl font-semibold bg-slate-800 text-white hover:bg-black transition-all duration-150 active:scale-[0.98] shadow-xs"
                  onClick={() => setIsBulkImportOpen(true)}
                >
                  Bulk CSV Import
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-rose-600 mb-3 font-medium">{error}</p>}

            {mode === 'new' ? (
              <form onSubmit={handleAddStudent} className="@container mb-5">
                <div className="grid @[400px]:grid-cols-2 @[640px]:grid-cols-5 gap-2.5">
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    placeholder="Roll number"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    placeholder="FULL NAME"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    value={joinTerm}
                    onChange={(e) => setJoinTerm(e.target.value as TermCode)}
                    title="Joined from term"
                  >
                    <option value="T1">Join T1</option>
                    <option value="T2">Join T2</option>
                    <option value="T3">Join T3</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-sais-red text-sais-white text-sm font-semibold px-4 py-2 hover:bg-sais-red-dark focus-visible:ring-2 focus-visible:ring-sais-red active:scale-[0.98] transition-all duration-150 shadow-xs"
                  >
                    Add Student
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEnrollExisting} className="@container mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-red-800" />
                      Enroll Existing Student into {activeClass.name} ({selectedAcademicYearId})
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Type student name or lifelong key (e.g. Ama, SAIS-2023) to see live pop-up matches.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800 text-white hover:bg-emerald-900 transition-all shadow-2xs flex items-center gap-1.5"
                    onClick={() => {
                      setIsPromoteModalOpen(true);
                      setSelectedPromoteKeys([]);
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Bulk Fast-Promote Class Roster</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Live Search & Autocomplete Input */}
                  <div className="md:col-span-2 relative space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">Search Student (Name or Lifelong Key):</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red shadow-2xs"
                        placeholder="Type student name or key (e.g. Ama, SAIS-2023-0042)..."
                        value={existingSearchQuery}
                        onChange={(e) => {
                          setExistingSearchQuery(e.target.value);
                          setExistingKey(e.target.value);
                          if (selectedStudentToEnroll) setSelectedStudentToEnroll(null);
                        }}
                      />
                    </div>

                    {/* Live Autocomplete Suggestions Popover */}
                    {matchingEnrollCandidates.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {matchingEnrollCandidates.map((st: any) => (
                          <button
                            key={st.studentKey}
                            type="button"
                            className="w-full text-left p-2.5 hover:bg-red-50/70 flex items-center justify-between transition-colors text-xs"
                            onClick={() => selectStudentForEnrollment(st)}
                          >
                            <div>
                              <p className="font-bold text-slate-900">{st.name}</p>
                              <p className="text-[11px] font-mono text-slate-500">
                                Key: <span className="font-semibold text-red-900">{st.studentKey}</span>
                                {st.prevClassLabel}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected Student Confirmation Pill */}
                    {selectedStudentToEnroll && (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          Selected: <strong>{selectedStudentToEnroll.name}</strong> ({selectedStudentToEnroll.studentKey})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Roll Number & Join Term Controls */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Roll Number:</label>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red transition-all shadow-2xs"
                        placeholder="e.g. STU-001"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red transition-all shadow-2xs"
                        value={joinTerm}
                        onChange={(e) => setJoinTerm(e.target.value as TermCode)}
                      >
                        <option value="T1">Join T1</option>
                        <option value="T2">Join T2</option>
                        <option value="T3">Join T3</option>
                      </select>

                      <button
                        type="submit"
                        disabled={!existingKey || !studentId}
                        className="rounded-xl bg-sais-red text-sais-white text-xs font-bold px-4 py-2 hover:bg-sais-red-dark disabled:opacity-40 transition-all shadow-2xs"
                      >
                        Enroll Student
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">#</th>
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">Roll</th>
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">Key</th>
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">Name</th>
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">Terms</th>
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">Attendance</th>
                    <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s) => (
                    <tr key={`${s.id}-${s.academicYear}`} className="border-b border-slate-100 last:border-0 even:bg-sais-brown/5 hover:bg-sais-red/5 transition-colors duration-150">
                      <td className="py-2.5 px-3 text-sais-muted text-xs font-mono">{s.index}</td>
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-sais-black">{s.studentId}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-sais-muted">{s.studentKey}</td>
                      <td className="py-2.5 px-3 font-medium text-sais-black">{s.name}</td>
                      <td className="py-2.5 px-3 text-xs text-sais-muted">
                        {(s.enrolledTerms || []).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono text-sais-black">
                        {s.attendance}/{activeClass.settings.attendanceTotal}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium transition-colors hover:underline"
                          onClick={() => openTransferModal(s.id, s.name)}
                        >
                          Transfer / leave
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Fast-Promote Class Roster from Previous Year Modal */}
      <Modal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        title={`Fast-Promote Class Roster into ${activeClass?.name || 'Class'}`}
        subtitle={`Select a source class from a previous academic year to bulk enroll students for ${selectedAcademicYearId}`}
      >
        <form onSubmit={handleExecutePromoteRoster} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Source Class Stream (Previous Academic Year):
            </label>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red shadow-xs cursor-pointer"
              value={promoteSourceClassId}
              onChange={(e) => {
                setPromoteSourceClassId(e.target.value);
                setSelectedPromoteKeys([]);
              }}
            >
              <option value="">-- Choose Class Stream to Import From --</option>
              {availableSourceClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({getStreamYearId(c).replace('-', '/')})
                </option>
              ))}
            </select>
          </div>

          {promoteSourceClassId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-800">
                  Select Students ({promoteCandidates.length} available to enroll):
                </span>
                <button
                  type="button"
                  className="text-xs font-bold text-red-800 hover:underline"
                  onClick={() => {
                    if (selectedPromoteKeys.length === promoteCandidates.length) {
                      setSelectedPromoteKeys([]);
                    } else {
                      setSelectedPromoteKeys(promoteCandidates.map((c) => c.studentKey));
                    }
                  }}
                >
                  {selectedPromoteKeys.length === promoteCandidates.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {promoteCandidates.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  All students from this source class are already enrolled in {activeClass?.name}!
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                  {promoteCandidates.map((cand) => {
                    const isChecked = selectedPromoteKeys.includes(cand.studentKey);
                    return (
                      <label
                        key={cand.studentKey}
                        className="flex items-center justify-between p-2.5 hover:bg-red-50/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-red-800 focus:ring-red-600 w-4 h-4 cursor-pointer"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPromoteKeys((prev) => [...prev, cand.studentKey]);
                              } else {
                                setSelectedPromoteKeys((prev) => prev.filter((k) => k !== cand.studentKey));
                              }
                            }}
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{cand.name}</p>
                            <p className="text-[11px] font-mono text-slate-500">{cand.studentKey}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPromoteModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedPromoteKeys.length === 0}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-40 transition-all shadow-xs"
            >
              Enroll {selectedPromoteKeys.length} Selected Student(s)
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer / Leave Student Modal */}
      <Modal
        isOpen={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        title="Student Transfer / Leave"
        subtitle={`Update term enrollment records for ${transferTarget?.name || 'student'}`}
      >
        <form onSubmit={confirmTransfer} className="space-y-4">
          <p className="text-sm text-sais-muted">
            Select the last completed/enrolled term this academic year for{' '}
            <strong className="text-sais-black">{transferTarget?.name}</strong>:
          </p>
          <label className="block text-xs font-semibold text-sais-black uppercase tracking-wider">
            Last Completed Term
            <select
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
              value={transferTerm}
              onChange={(e) => setTransferTerm(e.target.value as TermCode)}
            >
              <option value="T1">Term 1 (T1)</option>
              <option value="T2">Term 2 (T2)</option>
              <option value="T3">Term 3 (T3)</option>
            </select>
          </label>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setTransferTarget(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sais-red px-4 py-2 text-sm font-semibold text-white hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs"
            >
              Confirm Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <BulkStudentImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        targetClassId={activeClass?.id}
      />
    </div>
  );
}
