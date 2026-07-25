import { FormEvent, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { getSubjectsForProgramme, getSubjectsForTerm, getAllUniqueSubjects } from '../../lib/programmeSchemas';
import type { Programme, User } from '../../types';

const getTeacherDisplayName = (t?: Partial<User> | null) => {
  if (!t) return '—';
  if (t.name && t.name.trim() !== '') return t.name;
  return t.email || '—';
};

const deduplicateByEmail = (list: User[]): User[] => {
  const map = new Map<string, User>();
  for (const u of list) {
    const key = (u.email || u.id || '').trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, u);
    } else {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...u,
        name: u.name && u.name.trim() !== '' ? u.name : existing.name,
        subjects: u.subjects && u.subjects.length > 0 ? u.subjects : existing.subjects,
      });
    }
  }
  return Array.from(map.values());
};

const sortTeachers = (list: User[]) =>
  deduplicateByEmail(list).sort((a, b) => {
    const nameA = a.name && a.name.trim() !== '' ? a.name : a.email || '';
    const nameB = b.name && b.name.trim() !== '' ? b.name : b.email || '';
    return nameA.localeCompare(nameB);
  });

export default function HeadteacherDashboard() {
  const { currentUser } = useAuth();
  const {
    schools,
    users,
    classes,
    registerSchool,
    updateSchool,
    updateUser,
    createClass,
    assignSubjectTeacher,
    setFormTeacher,
    updateClassSettings,
    seedDemoData,
  } = useDatabase();

  const school =
    schools.find((s) => s.headteacherId === currentUser?.id) ||
    schools.find((s) => s.id === currentUser?.schoolId) ||
    schools[0];

  const [schoolName, setSchoolName] = useState(school?.name || 'St. Adelaide International Schools');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [programme, setProgramme] = useState<Programme>('PRIMARY');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [manageClassId, setManageClassId] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectTeacherId, setSubjectTeacherId] = useState('');

  const masterSubjects = getAllUniqueSubjects();

  const isTeacherOrHeadteacher = (u: User) => u.role === 'teacher' || u.role === 'headteacher';

  // All teachers (dual role: teacher || headteacher) sorted alphabetically
  const teachers = sortTeachers(users.filter((u) => isTeacherOrHeadteacher(u)));

  // Assigned teachers in the current school (or with custom name/subjects configured)
  const assignedTeachers = sortTeachers(
    users.filter(
      (u) => isTeacherOrHeadteacher(u) && (!school || u.schoolId === school.id || (u.name && u.name.trim() !== '') || (u.subjects && u.subjects.length > 0))
    )
  );

  // Classes sorted alphabetically
  const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name));

  const managedClass = sortedClasses.find((c) => c.id === manageClassId) || sortedClasses[0] || null;
  const manageSubjects = managedClass
    ? [...getSubjectsForTerm(managedClass.programme, managedClass.settings.termYearInfo)].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const handleSelectTeacherToAssign = (id: string) => {
    setSelectedTeacherId(id);
    const found = users.find((u) => u.id === id);
    if (found) {
      setTeacherName(found.name || '');
      setSelectedSubjects(found.subjects || []);
    } else {
      setTeacherName('');
      setSelectedSubjects([]);
    }
  };

  const handleUnassignTeacher = (teacherId: string) => {
    updateUser(teacherId, {
      name: '',
      subjects: [],
    });
    if (selectedTeacherId === teacherId) {
      setSelectedTeacherId('');
      setTeacherName('');
      setSelectedSubjects([]);
    }
  };

  const toggleSubjectPill = (subjectName: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectName)
        ? prev.filter((s) => s !== subjectName)
        : [...prev, subjectName].sort((a, b) => a.localeCompare(b))
    );
  };

  const ensureSchool = () => {
    if (school) {
      updateSchool(school.id, { name: schoolName, headteacherId: currentUser!.id });
      return school.id;
    }
    return registerSchool({
      name: schoolName,
      headteacherId: currentUser!.id,
      address: 'P. O. Box DS 75, Dansoman – Accra',
      website: 'www.saintadelaideschools.org',
      email: 'info@saintadelaideschools.org, st.adelaideschools@gmail.com',
      tel: '020 798 8167 / 027 064 0112 / 024 597 0186',
    });
  };

  const handleAddTeacher = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;
    const schoolId = ensureSchool();
    updateUser(selectedTeacherId, {
      name: teacherName.trim(),
      subjects: selectedSubjects.sort((a, b) => a.localeCompare(b)),
      schoolId,
    });
    setTeacherName('');
    setSelectedTeacherId('');
    setSelectedSubjects([]);
  };

  const handleCreateClass = (e: FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !formTeacherId) return;
    const schoolId = ensureSchool();
    const classId = createClass({
      name: className.trim().toUpperCase(),
      schoolId,
      programme,
      teacherId: formTeacherId,
      settings: {
        teacherName: getTeacherDisplayName(teachers.find((t) => t.id === formTeacherId)),
      },
    });
    for (const sub of getSubjectsForProgramme(programme)) {
      assignSubjectTeacher(classId, sub.code, formTeacherId);
    }
    setClassName('');
    setManageClassId(classId);
  };

  const handleFormTeacherChange = (classId: string, teacherId: string) => {
    if (!teacherId) return;
    setFormTeacher(classId, teacherId);
    const name = getTeacherDisplayName(teachers.find((t) => t.id === teacherId));
    if (name) updateClassSettings(classId, { teacherName: name });
  };

  const [newYearInput, setNewYearInput] = useState('');
  const [creatingYear, setCreatingYear] = useState(false);
  const { createAcademicYear } = useDatabase();

  const handleCreateAcademicYear = async (e: FormEvent) => {
    e.preventDefault();
    if (!newYearInput.trim()) return;
    setCreatingYear(true);
    try {
      const yearStr = newYearInput.trim();
      await createAcademicYear(yearStr, 'upcoming');
      alert(`Academic Year "${yearStr}" and its 3 child terms (Term 1, Term 2, Term 3) successfully created!`);
      setNewYearInput('');
    } catch (err) {
      alert(`Error creating Academic Year: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreatingYear(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-sais-black font-display">Headteacher Dashboard</h1>
          <p className="text-sais-muted text-sm mt-1">
            Register school, teachers, academic years, and Primary/Secondary class streams
          </p>
        </div>
        <button
          onClick={() => seedDemoData()}
          className="rounded-xl bg-sais-black text-white px-4 py-2.5 text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all shadow-xs"
        >
          Seed Demo Classes
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
          <h2 className="font-bold text-sais-black text-lg font-display">School</h2>
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="School name"
            />
            <button
              onClick={() => ensureSchool()}
              className="rounded-xl bg-sais-red text-white px-5 py-2 text-sm font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs"
            >
              Save School
            </button>
          </div>
          {school && (
            <p className="text-xs text-sais-muted font-medium">
              Active school id: <span className="font-mono text-sais-black">{school.id}</span> ·{' '}
              <span className="font-semibold text-sais-black">{classes.filter((c) => c.schoolId === school.id).length}</span> classes
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
          <h2 className="font-bold text-sais-black text-lg font-display">Academic Year & Automated 3-Term Creation</h2>
          <form onSubmit={handleCreateAcademicYear} className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all font-mono"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              placeholder="e.g. 2027/2028"
              required
            />
            <button
              type="submit"
              disabled={creatingYear}
              className="rounded-xl bg-red-800 text-white px-5 py-2 text-sm font-semibold hover:bg-red-900 active:scale-[0.98] transition-all shadow-xs disabled:opacity-50 whitespace-nowrap"
            >
              {creatingYear ? 'Creating...' : '+ Add Year & 3 Terms'}
            </button>
          </form>
          <p className="text-xs text-slate-500 font-medium">
            Baseline active years <span className="font-bold text-slate-800 font-mono">2025/2026</span> & <span className="font-bold text-slate-800 font-mono">2026/2027</span> with 3 child terms each are initialized automatically.
          </p>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
          <h2 className="font-bold text-sais-black text-lg font-display mb-2">Assign & Configure Teacher</h2>
          <form onSubmit={handleAddTeacher} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-sais-muted uppercase tracking-wider mb-1">
                Select Teacher
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                value={selectedTeacherId}
                onChange={(e) => handleSelectTeacherToAssign(e.target.value)}
                required
              >
                <option value="">Select teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTeacherDisplayName(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2.5">
              <input
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Set teacher's full name"
                required
              />
              <button type="submit" className="rounded-xl bg-sais-brown text-white px-5 py-2 text-sm font-semibold hover:bg-sais-brown-light active:scale-[0.98] transition-all shadow-xs">
                Save Teacher
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sais-muted uppercase tracking-wider mb-2">
                Teacher Specializations (Select Subjects)
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                {masterSubjects.map((sub) => {
                  const isSelected = selectedSubjects.includes(sub.name);
                  return (
                    <button
                      type="button"
                      key={sub.code}
                      onClick={() => toggleSubjectPill(sub.name)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sais-red text-white border-sais-red shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </form>

          <div className="pt-2">
            <h3 className="text-xs font-semibold text-sais-muted uppercase tracking-wider mb-2">Assigned Teachers & Specializations</h3>
            <ul className="space-y-2 text-sm divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
              {assignedTeachers.map((t) => (
                <li key={t.id} className="pt-2 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sais-black">{getTeacherDisplayName(t)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTeacherToAssign(t.id)}
                        className="text-xs text-sais-red hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnassignTeacher(t.id)}
                        className="text-xs text-slate-500 hover:text-red-600 hover:underline font-medium"
                      >
                        Unassign
                      </button>
                      <span className="text-sais-muted text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
                        {t.id?.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  {t.subjects && t.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {[...t.subjects].sort((a, b) => a.localeCompare(b)).map((s) => (
                        <span key={s} className="bg-slate-100 text-slate-600 border border-slate-200/60 rounded-md px-2 py-0.5 text-[11px] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {!assignedTeachers.length && <li className="text-sais-muted py-2 italic">No teachers assigned yet</li>}
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
          <h2 className="font-bold text-sais-black text-lg font-display mb-1">Create Class Stream</h2>
          <form onSubmit={handleCreateClass} className="space-y-3.5">
            <input
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. YEAR FIVE (A)"
            />
            <select
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
              value={programme}
              onChange={(e) => setProgramme(e.target.value as Programme)}
            >
              <option value="PRIMARY">PRIMARY</option>
              <option value="LOWER_SECONDARY">LOWER SECONDARY</option>
              <option value="UPPER_SECONDARY">UPPER SECONDARY</option>
            </select>
            <select
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
              value={formTeacherId}
              onChange={(e) => setFormTeacherId(e.target.value)}
              required
            >
              <option value="">Select form teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {getTeacherDisplayName(t)}
                </option>
              ))}
            </select>
            <button type="submit" className="w-full rounded-xl bg-sais-red text-white px-4 py-2.5 text-sm font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs">
              Create Class
            </button>
          </form>
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-5">
        <div>
          <h2 className="font-bold text-sais-black text-lg font-display">Assign / reassign teachers</h2>
          <p className="text-xs text-sais-muted mt-1">
            Changes cascade into active-year enrollments so both outgoing and incoming teachers keep
            transcript access.
          </p>
        </div>
        {!sortedClasses.length ? (
          <p className="text-sm text-sais-muted italic">Create or seed a class first.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-sais-muted mb-1.5">Class</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                  value={managedClass?.id || ''}
                  onChange={(e) => {
                    setManageClassId(e.target.value);
                    setSubjectCode('');
                  }}
                >
                  {sortedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.programme})
                    </option>
                  ))}
                </select>
              </div>
              {managedClass && (
                <div>
                  <label className="block text-xs font-medium text-sais-muted mb-1.5">Form teacher</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                    value={managedClass.teacherId}
                    onChange={(e) => handleFormTeacherChange(managedClass.id, e.target.value)}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {getTeacherDisplayName(t)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {managedClass && (
              <form
                className="grid sm:grid-cols-3 gap-3 items-end pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!subjectCode || !subjectTeacherId) return;
                  assignSubjectTeacher(managedClass.id, subjectCode, subjectTeacherId);
                  setSubjectCode('');
                  setSubjectTeacherId('');
                }}
              >
                <div>
                  <label className="block text-xs font-medium text-sais-muted mb-1.5">Subject</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    required
                  >
                    <option value="">Select subject</option>
                    {manageSubjects.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-sais-muted mb-1.5">Subject teacher</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                    value={subjectTeacherId}
                    onChange={(e) => setSubjectTeacherId(e.target.value)}
                    required
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {getTeacherDisplayName(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-sais-red text-white px-4 py-2.5 text-sm font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs"
                >
                  Assign subject
                </button>
              </form>
            )}

            {managedClass && (
              <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
                      <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Subject</th>
                      <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageSubjects.map((s) => {
                      const asg = managedClass.subjectTeachers.find(
                        (st) => st.subjectCode === s.code
                      );
                      const teacher = users.find((u) => u.id === asg?.teacherId);
                      return (
                        <tr key={s.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3.5 font-medium text-sais-black">{s.name}</td>
                          <td className="py-2.5 px-3.5 text-sais-black">
                            {getTeacherDisplayName(teacher)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <h2 className="font-bold text-sais-black text-lg font-display mb-4">Classes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Class</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Programme</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Form Teacher</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Subjects</th>
              </tr>
            </thead>
            <tbody>
              {sortedClasses.map((c) => {
                const teacher = users.find((u) => u.id === c.teacherId);
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-sais-black">{c.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-sais-muted border border-slate-200/50">
                        {c.programme}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-sais-black">
                      {getTeacherDisplayName(teacher)}
                    </td>
                    <td className="py-2.5 px-4 text-sais-muted font-mono text-xs">
                      {getSubjectsForTerm(c.programme, c.settings.termYearInfo).length} subjects
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
