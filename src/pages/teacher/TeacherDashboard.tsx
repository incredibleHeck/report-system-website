import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass, useDatabase } from '../../context/DatabaseContext';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import { normalizeGender } from '../../lib/gender';
import { termsFromJoin } from '../../lib/academicYear';
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

  const handleTransfer = (studentLifeId: string, studentName: string) => {
    const raw = window.prompt(
      `Last completed/enrolled term this year for ${studentName}? (T1, T2, or T3)`,
      'T1'
    );
    if (!raw) return;
    const last = raw.trim().toUpperCase() as TermCode;
    if (!['T1', 'T2', 'T3'].includes(last)) {
      alert('Enter T1, T2, or T3');
      return;
    }
    try {
      transferStudent(studentLifeId, last);
      alert(`${studentName} marked transferred; enrolled terms trimmed through ${last}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  if (!visibleClasses.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <h1 className="text-xl font-bold">No classes assigned</h1>
        <p className="text-slate-500 mt-2 text-sm">
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
          <h1 className="text-2xl font-bold text-slate-900">Class Workspace</h1>
          <p className="text-sm text-slate-500 mt-1">
            Form teacher: {users.find((u) => u.id === activeClass?.teacherId)?.name || '—'}
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Active class</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[220px]"
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
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Programme</p>
              <p className="font-semibold">{activeClass.programme}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Students</p>
              <p className="font-semibold">{classStudents.length}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Term</p>
              <p className="font-semibold text-sm">{activeClass.settings.termYearInfo}</p>
            </div>
          </div>

          <section>
            <h2 className="font-semibold mb-3">Subjects</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects.map((sub) => (
                <Link
                  key={sub.code}
                  to={`/teacher/subjects/${sub.code}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:border-sais-red hover:shadow-sm transition"
                >
                  <p className="font-semibold text-slate-900">{sub.name}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase">{sub.kind}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold">Classlist</h2>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className={`px-2 py-1 rounded ${mode === 'new' ? 'bg-sais-red text-white' : 'bg-slate-100'}`}
                  onClick={() => setMode('new')}
                >
                  Add new
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 rounded ${mode === 'existing' ? 'bg-sais-red text-white' : 'bg-slate-100'}`}
                  onClick={() => setMode('existing')}
                >
                  Enroll existing
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}

            {mode === 'new' ? (
              <form onSubmit={handleAddStudent} className="grid sm:grid-cols-5 gap-2 mb-4">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Roll number"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="FULL NAME"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option>Male</option>
                  <option>Female</option>
                </select>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={joinTerm}
                  onChange={(e) => setJoinTerm(e.target.value as TermCode)}
                  title="Joined from term"
                >
                  <option value="T1">Join T1</option>
                  <option value="T2">Join T2</option>
                  <option value="T3">Join T3</option>
                </select>
                <button type="submit" className="rounded-lg bg-sais-red text-white text-sm px-3 py-2">
                  Add Student
                </button>
              </form>
            ) : (
              <form onSubmit={handleEnrollExisting} className="grid sm:grid-cols-4 gap-2 mb-4">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder="SAIS-YYYY-NNNN"
                  value={existingKey}
                  onChange={(e) => setExistingKey(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="New roll number"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={joinTerm}
                  onChange={(e) => setJoinTerm(e.target.value as TermCode)}
                >
                  <option value="T1">Join T1</option>
                  <option value="T2">Join T2</option>
                  <option value="T3">Join T3</option>
                </select>
                <button type="submit" className="rounded-lg bg-sais-red text-white text-sm px-3 py-2">
                  Enroll
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Roll</th>
                    <th className="py-2 pr-3">Key</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Terms</th>
                    <th className="py-2 pr-3">Attendance</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s) => (
                    <tr key={`${s.id}-${s.academicYear}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{s.index}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{s.studentId}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{s.studentKey}</td>
                      <td className="py-2 pr-3 font-medium">{s.name}</td>
                      <td className="py-2 pr-3 text-xs">
                        {(s.enrolledTerms || []).join(', ')}
                      </td>
                      <td className="py-2 pr-3">
                        {s.attendance}/{activeClass.settings.attendanceTotal}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="text-xs text-rose-600"
                          onClick={() => handleTransfer(s.id, s.name)}
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
    </div>
  );
}
