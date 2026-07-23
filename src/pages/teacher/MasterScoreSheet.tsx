import { useEffect, useMemo, useState } from 'react';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { getScoredSubjects } from '../../lib/programmeSchemas';
import { shouldIncludeProjectWork } from '../../lib/term';
import { buildSummaries, computeClassAverages, scoresForClass } from '../../lib/reportMath';
import { parseAcademicYear } from '../../lib/academicYear';
import { useAuth } from '../../context/AuthContext';

export default function MasterScoreSheet() {
  const { currentUser } = useAuth();
  const { activeClass, classStudents, academicYear } = useActiveClass();
  const { scores, summaries, finalizeReports, unfinalizeReport, updateStudent, upsertScores } =
    useDatabase();
  const [mode, setMode] = useState<'EOT' | 'MIDTERM'>('EOT');
  const [general, setGeneral] = useState<Record<string, string>>({});
  const [pe, setPe] = useState<Record<string, string>>({});
  const [club, setClub] = useState<Record<string, string>>({});

  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : '';
  const year =
    academicYear ||
    (activeClass ? parseAcademicYear(activeClass.settings.termYearInfo) : '');

  const scoredSubjects = activeClass
    ? getScoredSubjects(
        activeClass.programme,
        shouldIncludeProjectWork(activeClass.settings.termYearInfo)
      )
    : [];

  const classScores = useMemo(() => {
    if (!activeClass) return [];
    return scoresForClass(scores, activeClass.id, mode, termKey);
  }, [scores, activeClass, mode, termKey]);

  const avgs = useMemo(
    () => computeClassAverages(classScores, scoredSubjects.map((s) => s.code)),
    [classScores, scoredSubjects]
  );

  const draft = useMemo(() => {
    if (!activeClass) return [];
    return buildSummaries({
      classStream: activeClass,
      students: classStudents,
      scores,
      mode,
      termKey,
      peComments: pe,
      clubComments: club,
      generalComments: general,
    });
  }, [activeClass, classStudents, scores, mode, termKey, pe, club, general]);

  useEffect(() => {
    if (!activeClass) return;
    const g: Record<string, string> = {};
    const p: Record<string, string> = {};
    const c: Record<string, string> = {};
    for (const st of classStudents) {
      const sum = summaries.find(
        (s) =>
          s.studentId === st.id &&
          s.classId === activeClass.id &&
          s.mode === mode &&
          s.termKey === termKey
      );
      g[st.id] = sum?.generalComment || '';
      p[st.id] = sum?.peComment || '';
      c[st.id] = sum?.clubComment || '';
      const peScore = classScores.find((x) => x.studentId === st.id && x.subjectCode === 'PE');
      const clubScore = classScores.find(
        (x) => x.studentId === st.id && x.subjectCode === 'CLUB'
      );
      if (peScore?.comment) p[st.id] = peScore.comment;
      if (clubScore?.comment) c[st.id] = clubScore.comment;
    }
    setGeneral(g);
    setPe(p);
    setClub(c);
  }, [activeClass?.id, mode, termKey, classStudents.length, summaries.length]);

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const isFormTeacher = activeClass.teacherId === currentUser?.id;

  const finalize = () => {
    if (!isFormTeacher) {
      alert('Only the form teacher can finalize the master sheet.');
      return;
    }
    const rows = buildSummaries({
      classStream: activeClass,
      students: classStudents,
      scores,
      mode,
      termKey,
      peComments: pe,
      clubComments: club,
      generalComments: general,
    }).map((r) => ({
      ...r,
      finalized: true,
      teacherName: activeClass.settings.teacherName,
    }));

    finalizeReports(rows);

    upsertScores(
      classStudents.flatMap((st) => [
        {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: 'PE',
          mode,
          termKey,
          academicYear: year,
          totalScore: 0,
          grade: '',
          comment: pe[st.id] || '',
        },
        {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: 'CLUB',
          mode,
          termKey,
          academicYear: year,
          totalScore: 0,
          grade: '',
          comment: club[st.id] || '',
        },
      ])
    );

    alert(`Finalized ${rows.length} ${mode} reports`);
  };

  const unfinalizeSelected = () => {
    if (!isFormTeacher) return;
    const target = classStudents[0];
    if (!target) return;
    const ok = confirm(
      `Unfinalize ${mode} report for ${target.name}? This clears frozen snapshot fields.`
    );
    if (!ok) return;
    unfinalizeReport(target.id, year, termKey, mode);
    alert('Unfinalized (snapshot cleared).');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Master Score Sheet</h1>
          <p className="text-sm text-slate-500">{activeClass.name}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'EOT' | 'MIDTERM')}
          >
            <option value="EOT">EOT</option>
            <option value="MIDTERM">Midterm</option>
          </select>
          <button
            onClick={finalize}
            className="rounded-lg bg-sais-red text-sais-white px-4 py-2 text-sm hover:bg-sais-red-dark disabled:opacity-50"
            disabled={!isFormTeacher}
          >
            Finalize Reports
          </button>
          <button
            onClick={unfinalizeSelected}
            className="rounded-lg border border-slate-300 text-slate-700 px-4 py-2 text-sm disabled:opacity-50"
            disabled={!isFormTeacher || classStudents.length === 0}
            title="Unfinalize first student (clears snapshot)"
          >
            Unfinalize first
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left">Student</th>
              {scoredSubjects.map((s) => (
                <th key={s.code} className="px-2 py-2" title={`Avg ${avgs[s.code] || 0}`}>
                  {s.abbr}
                </th>
              ))}
              <th className="px-2 py-2">Raw</th>
              <th className="px-2 py-2">Avg</th>
              <th className="px-2 py-2">Rank</th>
              <th className="px-2 py-2">Att</th>
              <th className="px-2 py-2 text-left">General Comment</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row) => {
              const st = classStudents.find((s) => s.id === row.studentId)!;
              return (
                <tr key={row.studentId} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium whitespace-nowrap">{st.name}</td>
                  {scoredSubjects.map((sub) => {
                    const sc = classScores.find(
                      (x) => x.studentId === st.id && x.subjectCode === sub.code
                    );
                    return (
                      <td key={sub.code} className="px-2 py-2 text-center">
                        {sc?.totalScore ?? '—'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold">{row.rawScore}</td>
                  <td className="px-2 py-2 text-center">
                    {row.averageScore} ({row.aveGrade})
                  </td>
                  <td className="px-2 py-2 text-center">{row.rank}</td>
                  <td className="px-2 py-2 text-center">
                    <input
                      className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center"
                      value={st.attendance}
                      onChange={(e) =>
                        updateStudent(st.id, { attendance: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[220px]">
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1"
                      value={general[st.id] || ''}
                      onChange={(e) =>
                        setGeneral((prev) => ({ ...prev, [st.id]: e.target.value }))
                      }
                      placeholder="Class teacher comment"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode === 'EOT' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold mb-2">PE Comments</h3>
            {classStudents.map((st) => (
              <input
                key={st.id}
                className="w-full mb-2 rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder={st.name}
                value={pe[st.id] || ''}
                onChange={(e) => setPe((prev) => ({ ...prev, [st.id]: e.target.value }))}
              />
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold mb-2">Club Comments</h3>
            {classStudents.map((st) => (
              <input
                key={st.id}
                className="w-full mb-2 rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder={st.name}
                value={club[st.id] || ''}
                onChange={(e) => setClub((prev) => ({ ...prev, [st.id]: e.target.value }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
