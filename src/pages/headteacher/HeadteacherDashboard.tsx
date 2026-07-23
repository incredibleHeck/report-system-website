import { FormEvent, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { getSubjectsForProgramme, getSubjectsForTerm } from '../../lib/programmeSchemas';
import type { Programme } from '../../types';

export default function HeadteacherDashboard() {
  const { currentUser } = useAuth();
  const {
    schools,
    users,
    classes,
    registerSchool,
    updateSchool,
    addTeacher,
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
  const [teacherName, setTeacherName] = useState('');
  const [className, setClassName] = useState('');
  const [programme, setProgramme] = useState<Programme>('PRIMARY');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [manageClassId, setManageClassId] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectTeacherId, setSubjectTeacherId] = useState('');

  const teachers = users.filter(
    (u) => u.role === 'teacher' && (!school || u.schoolId === school.id)
  );

  const managedClass = classes.find((c) => c.id === manageClassId) || classes[0] || null;
  const manageSubjects = managedClass
    ? getSubjectsForTerm(managedClass.programme, managedClass.settings.termYearInfo)
    : [];

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
    if (!teacherName.trim()) return;
    const schoolId = ensureSchool();
    addTeacher({ name: teacherName.trim(), schoolId });
    setTeacherName('');
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
        teacherName: teachers.find((t) => t.id === formTeacherId)?.name || '',
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
    const name = teachers.find((t) => t.id === teacherId)?.name;
    if (name) updateClassSettings(classId, { teacherName: name });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Headteacher Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Register school, teachers, and Primary/Secondary class streams
          </p>
        </div>
        <button
          onClick={() => seedDemoData()}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
        >
          Seed Demo Classes
        </button>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">School</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="School name"
          />
          <button
            onClick={() => ensureSchool()}
            className="rounded-lg bg-sais-red text-white px-4 py-2 text-sm"
          >
            Save School
          </button>
        </div>
        {school && (
          <p className="text-xs text-slate-500">
            Active school id: {school.id} ·{' '}
            {classes.filter((c) => c.schoolId === school.id).length} classes
          </p>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-3">Add Teacher</h2>
          <form onSubmit={handleAddTeacher} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Teacher full name"
            />
            <button type="submit" className="rounded-lg bg-sais-brown text-white px-4 py-2 text-sm">
              Add
            </button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {teachers.map((t) => (
              <li key={t.id} className="flex justify-between border-b border-slate-100 py-2">
                <span>{t.name}</span>
                <span className="text-slate-400 text-xs font-mono">{t.id.slice(0, 8)}</span>
              </li>
            ))}
            {!teachers.length && <li className="text-slate-400">No teachers yet</li>}
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-3">Create Class Stream</h2>
          <form onSubmit={handleCreateClass} className="space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. YEAR FIVE (A)"
            />
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={programme}
              onChange={(e) => setProgramme(e.target.value as Programme)}
            >
              <option value="PRIMARY">PRIMARY</option>
              <option value="SECONDARY">SECONDARY</option>
            </select>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={formTeacherId}
              onChange={(e) => setFormTeacherId(e.target.value)}
              required
            >
              <option value="">Select form teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button type="submit" className="w-full rounded-lg bg-sais-red text-white px-4 py-2 text-sm">
              Create Class
            </button>
          </form>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Assign / reassign teachers</h2>
          <p className="text-xs text-slate-500 mt-1">
            Changes cascade into active-year enrollments so both outgoing and incoming teachers keep
            transcript access.
          </p>
        </div>
        {!classes.length ? (
          <p className="text-sm text-slate-400">Create or seed a class first.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Class</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={managedClass?.id || ''}
                  onChange={(e) => {
                    setManageClassId(e.target.value);
                    setSubjectCode('');
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.programme})
                    </option>
                  ))}
                </select>
              </div>
              {managedClass && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Form teacher</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={managedClass.teacherId}
                    onChange={(e) => handleFormTeacherChange(managedClass.id, e.target.value)}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {managedClass && (
              <form
                className="grid sm:grid-cols-3 gap-2 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!subjectCode || !subjectTeacherId) return;
                  assignSubjectTeacher(managedClass.id, subjectCode, subjectTeacherId);
                  setSubjectCode('');
                  setSubjectTeacherId('');
                }}
              >
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Subject</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                  <label className="block text-xs text-slate-500 mb-1">Subject teacher</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={subjectTeacherId}
                    onChange={(e) => setSubjectTeacherId(e.target.value)}
                    required
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-sais-red text-white px-3 py-2 text-sm"
                >
                  Assign subject
                </button>
              </form>
            )}

            {managedClass && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageSubjects.map((s) => {
                      const asg = managedClass.subjectTeachers.find(
                        (st) => st.subjectCode === s.code
                      );
                      return (
                        <tr key={s.code} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{s.name}</td>
                          <td className="py-2">
                            {users.find((u) => u.id === asg?.teacherId)?.name || '—'}
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

      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold mb-3">Classes</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Programme</th>
                <th className="py-2 pr-4">Form Teacher</th>
                <th className="py-2">Subjects</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {c.programme}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {users.find((u) => u.id === c.teacherId)?.name || '—'}
                  </td>
                  <td className="py-2 text-slate-500">
                    {getSubjectsForTerm(c.programme, c.settings.termYearInfo).length} subjects
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
