import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const missingDataItems: { studentId: string; studentName: string; detail: string }[] = [];

  for (const st of classStudents) {
    const summary = summaries.find(
      (s) => s.studentId === st.id && s.classId === activeClass.id && s.termKey === termKey && s.mode === 'EOT'
    );

    // Subject checks (CW, MT, EOT, and Comments)
    for (const sub of subjects) {
      const cwHit = scores.find(
        (x) => x.studentId === st.id && x.classId === activeClass.id && x.subjectCode === sub.code && x.mode === 'CW' && x.termKey === termKey
      );
      if (!cwHit) missingDataItems.push({ studentId: st.id, studentName: st.name, detail: `${sub.name} (Missing CW)` });

      const mtHit = scores.find(
        (x) => x.studentId === st.id && x.classId === activeClass.id && x.subjectCode === sub.code && x.mode === 'MT' && x.termKey === termKey
      );
      if (!mtHit) missingDataItems.push({ studentId: st.id, studentName: st.name, detail: `${sub.name} (Missing MT)` });

      const eotHit = scores.find(
        (x) => x.studentId === st.id && x.classId === activeClass.id && x.subjectCode === sub.code && x.mode === 'EOT' && x.termKey === termKey
      );
      if (!eotHit) missingDataItems.push({ studentId: st.id, studentName: st.name, detail: `${sub.name} (Missing EOT)` });

      const subLine = summary?.subjectLines?.find(l => l.code === sub.code);
      if (summary && (!subLine?.teacherComment || subLine.teacherComment.trim() === '')) {
        missingDataItems.push({ studentId: st.id, studentName: st.name, detail: `${sub.name} (Missing Comment)` });
      }
    }

    // General Comments
    if (summary && (!summary.generalComment || summary.generalComment.trim() === '')) {
      missingDataItems.push({ studentId: st.id, studentName: st.name, detail: 'Missing General Remarks' });
    }
  }

  const badContacts = classStudents.filter((st) => {
    const c = contacts.find((x) => (x.studentId === st.id || x.studentKey === st.studentKey) && x.classId === activeClass.id);
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

  const calculateCompletion = (completed: number, total: number) => {
    if (total === 0) return { percent: 100, text: 'No students' };
    return { percent: Math.round((completed / total) * 100), text: `${completed}/${total}` };
  };

  const genderStats = calculateCompletion(classStudents.length - missingGender.length, classStudents.length);
  const contactStats = calculateCompletion(classStudents.length - badContacts.length, classStudents.length);
  const finalizedStats = calculateCompletion(finalized.length, classStudents.length);

  const totalRequiredScores = classStudents.length * subjects.length * 3; // CW, MT, EOT
  const totalScoreGaps = missingDataItems.filter(item => item.detail.includes('Missing CW') || item.detail.includes('Missing MT') || item.detail.includes('Missing EOT')).length;
  const scoresStats = calculateCompletion(totalRequiredScores - totalScoreGaps, totalRequiredScores);

  const checks = [
    {
      title: 'Classlist gender',
      ok: missingGender.length === 0,
      detail: classStudents.length === 0 ? 'No students' : (missingGender.length ? `${missingGender.length} missing` : 'All set'),
      percent: genderStats.percent,
    },
    {
      title: 'Scores completeness',
      ok: totalScoreGaps === 0,
      detail: totalRequiredScores === 0 ? 'No students' : (totalScoreGaps ? `${totalScoreGaps} gaps` : 'All subjects filled'),
      percent: scoresStats.percent,
    },
    {
      title: 'Contacts validity',
      ok: badContacts.length === 0,
      detail: classStudents.length === 0 ? 'No students' : (badContacts.length ? `${badContacts.length} need attention` : 'OK'),
      percent: contactStats.percent,
    },
    {
      title: 'Class settings',
      ok: settingsGaps.length === 0,
      detail: settingsGaps.length ? settingsGaps.join(', ') : 'Complete',
      percent: settingsGaps.length === 0 ? 100 : 0,
    },
    {
      title: 'Master sheet finalized',
      ok: finalized.length === classStudents.length && classStudents.length > 0,
      detail: classStudents.length === 0 ? '0/0 finalized' : `${finalized.length}/${classStudents.length} finalized`,
      percent: finalizedStats.percent,
    },
    {
      title: 'Gemini API',
      ok: Boolean(apiHealth?.gemini),
      detail: apiHealth?.gemini ? 'Configured' : 'API offline or key missing',
      percent: apiHealth?.gemini ? 100 : 0,
    },
    {
      title: 'WhatsApp',
      ok: Boolean(apiHealth?.whatsapp),
      detail: apiHealth?.whatsapp ? 'Configured' : 'Optional — fallback available',
      percent: apiHealth?.whatsapp ? 100 : 0,
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
            <div className="flex justify-between items-start mb-1">
              <p className="font-semibold text-sm">{c.title}</p>
              <span className={`text-xs font-semibold ${c.percent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {c.percent}%
              </span>
            </div>
            
            <div className="w-full bg-black/5 rounded-full h-1.5 mb-2 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full ${c.percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                style={{ width: `${c.percent}%` }}
              />
            </div>
            <p className="text-xs text-slate-600">{c.detail}</p>
          </div>
        ))}
      </div>

      {missingDataItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Actionable Items</h3>
          <ul className="text-sm text-slate-600 space-y-2 max-h-64 overflow-y-auto pr-2">
            {missingDataItems.slice(0, 40).map((item, idx) => (
              <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span><strong className="text-slate-800">{item.studentName}</strong>: {item.detail}</span>
                <Link
                  to={`/teacher/master-sheet?student=${item.studentId}`}
                  className="text-xs font-semibold bg-white border border-slate-300 text-sais-red hover:bg-slate-50 px-3 py-1.5 rounded shadow-sm transition-colors"
                >
                  Fix Mark
                </Link>
              </li>
            ))}
            {missingDataItems.length > 40 && (
              <li className="text-center text-xs text-slate-400 py-2">
                ...and {missingDataItems.length - 40} more items.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
