import { FormEvent, useEffect, useState } from 'react';
import { useActiveClass, useDatabase } from '../../context/DatabaseContext';
import { detectTermNumber, shouldIncludeProjectWork } from '../../lib/term';

export default function ClassSettings() {
  const { activeClass } = useActiveClass();
  const { updateClassSettings } = useDatabase();
  const [form, setForm] = useState(activeClass?.settings);

  useEffect(() => {
    setForm(activeClass?.settings);
  }, [activeClass?.id, activeClass?.settings]);

  if (!activeClass || !form) {
    return <p className="text-slate-500">Select a class from the teacher dashboard first.</p>;
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const termNum = detectTermNumber(form.termYearInfo);
  const projectOn = shouldIncludeProjectWork(form.termYearInfo);

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    updateClassSettings(activeClass.id, {
      ...form,
      // Keep flag in sync with Term 3 rule for any legacy readers
      showProjectWork: shouldIncludeProjectWork(form.termYearInfo),
    });
    alert('Class settings saved');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Class Settings</h1>
        <p className="text-sm text-slate-500">
          {activeClass.name} · {activeClass.programme}
        </p>
      </div>

      <form onSubmit={onSave} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <label className="block text-sm">
          <span className="text-slate-600">Term / Academic Year</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.termYearInfo}
            onChange={(e) => set('termYearInfo', e.target.value)}
            placeholder="e.g. 2025/2026 — Term 2"
          />
          <p className="text-xs text-slate-500 mt-1">
            Detected term: {termNum ? `Term ${termNum}` : 'unknown'} · Project Work on EOT report:{' '}
            <strong>{projectOn ? 'Yes (Term 3 only)' : 'No (Terms 1 & 2)'}</strong>
          </p>
        </label>

        {(
          [
            ['teacherName', 'Class Teacher Name'],
            ['reportDate', 'Vacation / Report Date'],
            ['nextTermBegins', 'Next Term Begins'],
            ['schoolBreaks', 'Midterm: School Breaks'],
            ['schoolResumes', 'Midterm: School Resumes'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-slate-600">{label}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={String(form[key] ?? '')}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}

        <label className="block text-sm">
          <span className="text-slate-600">Attendance Total (days)</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.attendanceTotal}
            onChange={(e) => set('attendanceTotal', Number(e.target.value) || 0)}
          />
        </label>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
          Project Work is included on End of Term reports <strong>only in Term 3</strong>. Terms 1
          and 2 omit that row automatically (same as the Google Sheets vault).
        </div>

        <label className="block text-sm">
          <span className="text-slate-600">Name Format</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.nameFormat}
            onChange={(e) => set('nameFormat', e.target.value as 'LAST_FIRST' | 'FIRST_LAST')}
          >
            <option value="LAST_FIRST">LAST FIRST</option>
            <option value="FIRST_LAST">FIRST LAST</option>
          </select>
        </label>

        <button type="submit" className="rounded-lg bg-sais-red text-white px-4 py-2 text-sm">
          Save Settings
        </button>
      </form>
    </div>
  );
}
