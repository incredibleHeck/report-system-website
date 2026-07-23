import { useMemo, useState } from 'react';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../../context/DatabaseContext';
import { getScoredSubjects } from '../../../lib/programmeSchemas';
import { shouldIncludeProjectWork } from '../../../lib/term';
import {
  buildAuditPrompt,
  buildFixMismatchPrompt,
  buildPolishPrompt,
  buildPronounPrompt,
} from '../../../lib/ai/prompts';
import { extractJsonArray, generateWithGemini } from '../../../lib/ai/geminiClient';
import { useUndo } from '../../../context/UndoContext';
import { firstName } from '../../../lib/gender';

type Tool = 'polish' | 'pronouns' | 'mismatch' | 'audit';

export default function CommentToolsAi() {
  const { activeClass, classStudents } = useActiveClass();
  const { students, scores, upsertScores } = useDatabase();
  const { push } = useUndo();
  const [subjectCode, setSubjectCode] = useState('ENG');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tool, setTool] = useState<Tool>('polish');
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');

  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : '';
  const subjects = activeClass
    ? getScoredSubjects(
        activeClass.programme,
        shouldIncludeProjectWork(activeClass.settings.termYearInfo)
      )
    : [];
  const rows = useMemo(() => {
    return classStudents
      .map((st) => {
        const score = scores.find(
          (s) =>
            s.studentId === st.id &&
            s.classId === activeClass?.id &&
            s.subjectCode === subjectCode &&
            s.mode === 'EOT' &&
            s.termKey === termKey &&
            s.comment
        );
        return score ? { st, score } : null;
      })
      .filter(Boolean) as { st: (typeof classStudents)[0]; score: (typeof scores)[0] }[];
  }, [classStudents, scores, activeClass, subjectCode, termKey]);

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const run = async () => {
    const targets = rows.filter((r) => selected.has(r.st.id));
    if (!targets.length) {
      alert('Select comments to process');
      return;
    }
    setBusy(true);
    setStatus(`Running ${tool}…`);
    try {
      push({ type: 'scores', before: scores.map((s) => ({ ...s })) });
      let prompt = '';
      if (tool === 'polish') {
        prompt = buildPolishPrompt(
          targets.map((t, i) => ({ id: String(i), text: t.score.comment }))
        );
      } else if (tool === 'pronouns') {
        prompt = buildPronounPrompt(
          targets.map((t, i) => ({
            id: String(i),
            text: t.score.comment,
            gender: t.st.gender,
            name: firstName(t.st.name, activeClass.settings.nameFormat),
          }))
        );
      } else if (tool === 'mismatch') {
        prompt = buildFixMismatchPrompt(
          targets.map((t, i) => ({
            id: String(i),
            text: t.score.comment,
            name: firstName(t.st.name, activeClass.settings.nameFormat),
          }))
        );
      } else {
        prompt = buildAuditPrompt(
          targets.map((t, i) => ({
            id: String(i),
            text: t.score.comment,
            name: t.st.name,
          }))
        );
      }

      const res = await generateWithGemini(prompt, true);
      const parsed = (Array.isArray(res.parsed) ? res.parsed : extractJsonArray(res.text)) as Record<
        string,
        unknown
      >[];

      if (tool === 'audit') {
        const next: Record<string, string> = {};
        for (const item of parsed) {
          const t = targets[Number(item.id)];
          if (!t) continue;
          next[t.st.id] = `${item.severity || 'ok'}: ${((item.issues as string[]) || []).join('; ')}`;
        }
        setAudit(next);
        setStatus('Audit complete');
      } else {
        for (const item of parsed) {
          const t = targets[Number(item.id)];
          if (!t) continue;
          upsertScores([
            {
              ...t.score,
              comment: String(item.comment || t.score.comment),
            },
          ]);
        }
        setStatus(`Updated ${parsed.length} comments`);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Comment Tools</h1>
          <p className="text-sm text-slate-500">Polish · Pronouns · Name mismatch · Audit</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={tool}
            onChange={(e) => setTool(e.target.value as Tool)}
          >
            <option value="polish">Polish Grammar & Style</option>
            <option value="pronouns">Fix Pronouns</option>
            <option value="mismatch">Fix Name Mismatches</option>
            <option value="audit">Vet and Audit</option>
          </select>
          <button
            disabled={busy}
            onClick={run}
            className="rounded-lg bg-sais-red text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Run Tool
          </button>
        </div>
      </div>

      {status && (
        <div className="rounded-lg bg-slate-900 text-cyan-300 px-4 py-2 text-sm font-mono">{status}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Comment</th>
              <th className="px-3 py-2 text-left">Audit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, score }) => (
              <tr key={st.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(st.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(st.id)) next.delete(st.id);
                        else next.add(st.id);
                        return next;
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{st.name}</td>
                <td className="px-3 py-2 text-xs">{score.comment}</td>
                <td className="px-3 py-2 text-xs text-amber-700">{audit[st.id] || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
