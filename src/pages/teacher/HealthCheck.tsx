import { useEffect, useState } from 'react';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { getScoredSubjects } from '../../lib/programmeSchemas';
import { normalizeGhanaPhone } from '../../lib/phone';
import { shouldIncludeProjectWork } from '../../lib/term';

export default function HealthCheck() {
  const { activeClass, classStudents } = useActiveClass();
  const { students, scores, contacts, summaries } = useDatabase();
  const [apiHealth, setApiHealth] = useState<{
    ok?: boolean;
    gemini?: boolean;
    whatsapp?: boolean;
    smtp?: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setApiHealth)
      .catch(() => setApiHealth({ ok: false }));
  }, []);

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const termKey = termKeyFromSettings(activeClass.settings);
  const subjects = getScoredSubjects(
    activeClass.programme,
    shouldIncludeProjectWork(activeClass.settings.termYearInfo)
  );

  const missingGender = classStudents.filter((s) => !s.gender || s.gender === 'Unknown');
  const missingScores: string[] = [];
  for (const st of classStudents) {
    for (const sub of subjects) {
      const hit = scores.find(
        (x) =>
          x.studentId === st.id &&
          x.classId === activeClass.id &&
          x.subjectCode === sub.code &&
          x.mode === 'EOT' &&
          x.termKey === termKey
      );
      if (!hit) missingScores.push(`${st.name} — ${sub.name}`);
    }
  }

  const badContacts = classStudents.filter((st) => {
    const c = contacts.find((x) => x.studentId === st.id && x.classId === activeClass.id);
    if (!c?.phone && !c?.email) return true;
    if (c.phone && !normalizeGhanaPhone(c.phone).ok) return true;
    return false;
  });

  const settingsGaps = [
    !activeClass.settings.termYearInfo && 'Term/Year',
    !activeClass.settings.teacherName && 'Teacher name',
    !activeClass.settings.reportDate && 'Report date',
    !activeClass.settings.nextTermBegins && 'Next term begins',
  ].filter(Boolean) as string[];

  const finalized = summaries.filter(
    (s) => s.classId === activeClass.id && s.mode === 'EOT' && s.termKey === termKey && s.finalized
  );

  const checks = [
    {
      title: 'Classlist gender',
      ok: missingGender.length === 0,
      detail: missingGender.length ? `${missingGender.length} missing` : 'All set',
    },
    {
      title: 'EOT scores complete',
      ok: missingScores.length === 0,
      detail: missingScores.length ? `${missingScores.length} gaps` : 'All subjects filled',
    },
    {
      title: 'Contacts',
      ok: badContacts.length === 0,
      detail: badContacts.length ? `${badContacts.length} need attention` : 'OK',
    },
    {
      title: 'Class settings',
      ok: settingsGaps.length === 0,
      detail: settingsGaps.length ? settingsGaps.join(', ') : 'Complete',
    },
    {
      title: 'Master sheet finalized',
      ok: finalized.length === classStudents.length && classStudents.length > 0,
      detail: `${finalized.length}/${classStudents.length} finalized`,
    },
    {
      title: 'Gemini API',
      ok: Boolean(apiHealth?.gemini),
      detail: apiHealth?.gemini ? 'Configured' : 'API offline or key missing',
    },
    {
      title: 'WhatsApp',
      ok: Boolean(apiHealth?.whatsapp),
      detail: apiHealth?.whatsapp ? 'Configured' : 'Optional — fallback available',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health Check</h1>
        <p className="text-sm text-slate-500">{activeClass.name}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {checks.map((c) => (
          <div
            key={c.title}
            className={`rounded-xl border p-4 ${
              c.ok ? 'border-sais-brown/30 bg-sais-brown-soft' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p className="font-semibold text-sm">{c.title}</p>
            <p className="text-xs mt-1 text-slate-600">{c.detail}</p>
          </div>
        ))}
      </div>

      {missingScores.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold mb-2">Missing score samples</h3>
          <ul className="text-xs text-slate-600 space-y-1 max-h-40 overflow-y-auto">
            {missingScores.slice(0, 40).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
