import { FormEvent, useEffect, useState } from 'react';
import { useActiveClass, useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { detectTermNumber, shouldIncludeProjectWork } from '../../lib/term';

export default function ClassSettings() {
  const { currentUser } = useAuth();
  const { activeClass } = useActiveClass();
  const { updateClassSettings } = useDatabase();
  const [form, setForm] = useState(activeClass?.settings);

  useEffect(() => {
    setForm(activeClass?.settings);
  }, [activeClass?.id, activeClass?.settings]);

  if (!activeClass || !form) {
    return <p className="text-slate-500">Select a class from the teacher dashboard first.</p>;
  }

  const isHeadteacher = currentUser?.role === 'headteacher';
  const isFormTeacher = Boolean(
    currentUser?.id &&
      (activeClass.teacherId === currentUser.id ||
        (activeClass as any).formTeacherId === currentUser.id ||
        isHeadteacher)
  );

  if (!isFormTeacher) {
    return (
      <div className="max-w-2xl bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-6 shadow-sm space-y-2">
        <h1 className="text-xl font-bold font-display">Access Restricted</h1>
        <p className="text-sm">
          Class settings can only be edited by the assigned Form Teacher ({activeClass.settings?.teacherName || 'Form Teacher'}) or a Headteacher.
        </p>
      </div>
    );
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const termNum = detectTermNumber(form.termYearInfo);
  const projectOn = shouldIncludeProjectWork(form.termYearInfo);

  // Parse structured term parameters
  const [yearPart, termPart] = (form.termYearInfo || '2026/2027 — Term 1').split(' — ');
  const selectedYear = yearPart || '2026/2027';
  const selectedTerm = termPart || 'Term 1';

  const handleYearChange = (newYear: string) => {
    set('termYearInfo', `${newYear} — ${selectedTerm}`);
  };

  const handleTermChange = (newTerm: string) => {
    set('termYearInfo', `${selectedYear} — ${newTerm}`);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    updateClassSettings(activeClass.id, {
      ...form,
      showProjectWork: shouldIncludeProjectWork(form.termYearInfo),
    });
    alert('Class settings saved successfully');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sais-black font-display">Class Settings</h1>
        <p className="text-sm text-sais-muted mt-1">
          {activeClass.name} · {activeClass.programme}
        </p>
      </div>

      <form onSubmit={onSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-5">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-sais-black">
            <span className="text-sais-muted">Academic Year & Term</span>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs font-semibold"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
              >
                <option value="2026/2027">2026/2027 (Active Pointer)</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
                <option value="2023/2024">2023/2024</option>
                <option value="2022/2023">2022/2023</option>
                <option value="2021/2022">2021/2022</option>
              </select>

              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs font-semibold"
                value={selectedTerm}
                onChange={(e) => handleTermChange(e.target.value)}
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>
            <p className="text-xs text-sais-muted mt-1.5 font-normal">
              Detected term: {termNum ? `Term ${termNum}` : 'unknown'} · Project Work on EOT report:{' '}
              <strong className="text-sais-black">{projectOn ? 'Yes (Term 3 only)' : 'No (Terms 1 & 2)'}</strong>
            </p>
          </label>
        </div>

        {(
          [
            ['teacherName', 'Class Teacher Name'],
            ['reportDate', 'Vacation / Report Date'],
            ['nextTermBegins', 'Next Term Begins'],
            ['schoolBreaks', 'Midterm: School Breaks'],
            ['schoolResumes', 'Midterm: School Resumes'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium text-sais-black">
            <span className="text-sais-muted">{label}</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
              value={String(form[key] ?? '')}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}

        <label className="block text-sm font-medium text-sais-black">
          <span className="text-sais-muted">Attendance Total (days)</span>
          <input
            type="number"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
            value={form.attendanceTotal}
            onChange={(e) => set('attendanceTotal', Number(e.target.value) || 0)}
          />
        </label>

        <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-xs text-sais-muted">
          Project Work is included on End of Term reports <strong className="text-sais-black">only in Term 3</strong>. Terms 1
          and 2 omit that row automatically (same as the Google Sheets vault).
        </div>

        <label className="block text-sm font-medium text-sais-black">
          <span className="text-sais-muted">Name Format</span>
          <select
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
            value={form.nameFormat}
            onChange={(e) => set('nameFormat', e.target.value as 'LAST_FIRST' | 'FIRST_LAST')}
          >
            <option value="LAST_FIRST">LAST FIRST</option>
            <option value="FIRST_LAST">FIRST LAST</option>
          </select>
        </label>

        <button
          type="submit"
          className="rounded-xl bg-sais-red text-white font-semibold px-5 py-2.5 text-sm hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
}

