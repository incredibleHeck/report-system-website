import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass, useDatabase } from '../../context/DatabaseContext';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import { normalizeGender } from '../../lib/gender';
import { termsFromJoin } from '../../lib/academicYear';
import Modal from '../../components/ui/Modal';
import type { TermCode } from '../../types';

export default function TeacherDashboard() {
  const { currentUser } = useAuth();
  const {
    addStudent,
    enrollExistingStudent,
    transferStudent,
    users,
  } = useDatabase();
  const { activeClass, classes, setActiveClassId, classStudents } = useActiveClass();

  const myClasses = classes.filter(
    (c) =>
      c.teacherId === currentUser?.id ||
      c.subjectTeachers.some((st) => st.teacherId === currentUser?.id)
  );
  const visibleClasses = myClasses.length ? myClasses : classes;

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Male');
  const [existingKey, setExistingKey] = useState('');
  const [joinTerm, setJoinTerm] = useState<TermCode>('T1');
  const [error, setError] = useState('');

  // Transfer modal state
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
  const [transferTerm, setTransferTerm] = useState<TermCode>('T1');

  const handleAddStudent = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!activeClass || !studentId.trim() || !name.trim()) return;
    const nextIndex = String(classStudents.length + 1).padStart(3, '0');
    try {
      addStudent({
        studentId: studentId.trim().toUpperCase(),
        name: name.trim().toUpperCase(),
        gender: normalizeGender(gender),
        index: nextIndex,
        classId: activeClass.id,
        schoolId: activeClass.schoolId,
        attendance: activeClass.settings.attendanceTotal,
        enrolledTerms: termsFromJoin(joinTerm),
      });
      setStudentId('');
      setName('');
      setJoinTerm('T1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add student');
    }
  };

  const handleEnrollExisting = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!activeClass || !existingKey.trim() || !studentId.trim()) return;
    const nextIndex = String(classStudents.length + 1).padStart(3, '0');
    try {
      enrollExistingStudent({
        studentKey: existingKey.trim().toUpperCase(),
        classId: activeClass.id,
        rollNumber: studentId.trim().toUpperCase(),
        index: nextIndex,
        enrolledTerms: termsFromJoin(joinTerm),
      });
      setExistingKey('');
      setStudentId('');
      setJoinTerm('T1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enroll student');
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

  if (!visibleClasses.length) {
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
    ? getSubjectsForTerm(activeClass.programme, activeClass.settings.termYearInfo)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-sais-black font-display">Class Workspace</h1>
          <p className="text-sm text-sais-muted mt-1">
            Form teacher: <span className="font-semibold text-sais-black">{users.find((u) => u.id === activeClass?.teacherId)?.name || '—'}</span>
          </p>
        </div>
        <div>
          <label className="block text-xs text-sais-muted mb-1.5 font-medium">Active class</label>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all min-w-[220px]"
            value={activeClass?.id || ''}
            onChange={(e) => setActiveClassId(e.target.value)}
          >
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.programme})
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeClass && (
        <>
          <div className="@container">
            <div className="grid @[380px]:grid-cols-2 @[600px]:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                <p className="text-xs text-sais-muted font-medium uppercase tracking-wider">Programme</p>
                <p className="font-bold text-sais-black text-lg mt-1">{activeClass.programme}</p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                <p className="text-xs text-sais-muted font-medium uppercase tracking-wider">Students</p>
                <p className="font-bold text-sais-black text-lg mt-1">{classStudents.length}</p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                <p className="text-xs text-sais-muted font-medium uppercase tracking-wider">Term</p>
                <p className="font-bold text-sais-black text-base mt-1">{activeClass.settings.termYearInfo}</p>
              </div>
            </div>
          </div>

          <section className="@container">
            <h2 className="font-bold text-sais-black mb-4 text-lg font-display">Subjects</h2>
            <div className="grid @[380px]:grid-cols-2 @[640px]:grid-cols-3 gap-4">
              {subjects.map((sub) => (
                <Link
                  key={sub.code}
                  to={`/teacher/subjects/${sub.code}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-sais-red/60 hover:shadow-md active:scale-[0.99] transition-all duration-200 flex flex-col justify-between space-y-3 group"
                >
                  <p className="font-bold text-sais-black group-hover:text-sais-red transition-colors">{sub.name}</p>
                  <div>
                    <span className="inline-block text-[11px] font-mono font-medium text-sais-muted uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/50">
                      {sub.kind}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-sais-black text-lg font-display">Classlist</h2>
              <div className="flex gap-2 text-xs">
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
              <form onSubmit={handleEnrollExisting} className="@container mb-5">
                <div className="grid @[400px]:grid-cols-2 @[640px]:grid-cols-4 gap-2.5">
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    placeholder="SAIS-YYYY-NNNN"
                    value={existingKey}
                    onChange={(e) => setExistingKey(e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    placeholder="New roll number"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
                    value={joinTerm}
                    onChange={(e) => setJoinTerm(e.target.value as TermCode)}
                  >
                    <option value="T1">Join T1</option>
                    <option value="T2">Join T2</option>
                    <option value="T3">Join T3</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-sais-red text-sais-white text-sm font-semibold px-4 py-2 hover:bg-sais-red-dark focus-visible:ring-2 focus-visible:ring-sais-red active:scale-[0.98] transition-all duration-150 shadow-xs"
                  >
                    Enroll
                  </button>
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
    </div>
  );
}
