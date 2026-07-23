import { useMemo, useState } from 'react';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../../context/DatabaseContext';
import { getScoredSubjects } from '../../../lib/programmeSchemas';
import { shouldIncludeProjectWork } from '../../../lib/term';
import { firstName } from '../../../lib/gender';
import { buildSubjectCommentPrompt } from '../../../lib/ai/prompts';
import { extractJsonArray, generateWithGemini } from '../../../lib/ai/geminiClient';
import { useUndo } from '../../../context/UndoContext';

export default function SubjectCommentsAi() {
  const { activeClass, classStudents } = useActiveClass();
  const {
    students,
    scores,
    upsertScores,
    subjectContexts,
    bannedTokens,
    mergeBannedTokens,
  } = useDatabase();
  const { push } = useUndo();
  const [subjectCode, setSubjectCode] = useState('ENG');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : '';
  const subjects = activeClass
    ? getScoredSubjects(
        activeClass.programme,
        shouldIncludeProjectWork(activeClass.settings.termYearInfo)
      )
    : [];
  const ctx = subjectContexts.find(
    (c) => c.classId === activeClass?.id && c.subjectCode === subjectCode
  );

  const rows = useMemo(() => {
    return classStudents.map((st) => {
      const score = scores.find(
        (s) =>
          s.studentId === st.id &&
          s.classId === activeClass?.id &&
          s.subjectCode === subjectCode &&
          s.mode === 'EOT' &&
          s.termKey === termKey
      );
      return { st, score };
    });
  }, [classStudents, scores, activeClass, subjectCode, termKey]);

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectMissing = () => {
    setSelected(
      new Set(rows.filter((r) => !r.score?.comment).map((r) => r.st.id))
    );
  };

  const generate = async () => {
    const targets = rows.filter((r) => selected.has(r.st.id) && r.score);
    if (!targets.length) {
      alert('Select students that already have scores saved.');
      return;
    }
    setBusy(true);
    setStatus('Calling Gemini…');
    try {
      push({ type: 'scores', before: scores.map((s) => ({ ...s })) });
      const subjectName = subjects.find((s) => s.code === subjectCode)?.name || subjectCode;
      const payload = targets.map((t, idx) => {
        const ledger = bannedTokens.find(
          (b) =>
            b.studentId === t.st.id && b.classId === activeClass.id && b.termKey === termKey
        );
        return {
          id: String(idx),
          name: firstName(t.st.name, activeClass.settings.nameFormat),
          gender: t.st.gender,
          score: t.score!.totalScore,
          subject: subjectName,
          bannedTokens: ledger?.tokens || [],
          isPractical: ['MUSIC', 'PROJ', 'PE', 'CLUB'].includes(subjectCode),
        };
      });

      const prompt = buildSubjectCommentPrompt(payload, {
        grade: ctx?.gradeBand,
        topics: ctx?.topics.join(', '),
      });
      const res = await generateWithGemini(prompt, true);
      const parsed =
        (Array.isArray(res.parsed) ? res.parsed : extractJsonArray(res.text)) as {
          id: string;
          comment: string;
          tokensUsed?: string[];
        }[];

      for (const item of parsed) {
        const target = targets[Number(item.id)];
        if (!target?.score) continue;
        upsertScores([
          {
            ...target.score,
            comment: item.comment,
          },
        ]);
        if (item.tokensUsed?.length) {
          mergeBannedTokens(target.st.id, activeClass.id, termKey, item.tokensUsed);
        }
      }
      setStatus(`Generated ${parsed.length} comments`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Subject Comments</h1>
          <p className="text-sm text-slate-500">
            Context: {ctx?.gradeBand || 'not set'} · {ctx?.topics?.length || 0} topics
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <button onClick={selectMissing} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Select missing
          </button>
          <button
            disabled={busy}
            onClick={generate}
            className="rounded-lg bg-sais-red text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Auto-Generate
          </button>
        </div>
      </div>

      {status && (
        <div className="rounded-lg bg-slate-900 text-lime-300 px-4 py-2 text-sm font-mono">{status}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2 text-left">Comment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, score }) => (
              <tr key={st.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(st.id)}
                    onChange={() => toggle(st.id)}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{st.name}</td>
                <td className="px-3 py-2 text-center">{score?.totalScore ?? '—'}</td>
                <td className={`px-3 py-2 text-xs ${score?.comment ? 'bg-lime-50' : ''}`}>
                  {score?.comment || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
