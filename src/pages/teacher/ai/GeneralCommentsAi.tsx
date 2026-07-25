import { useState } from 'react';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../../context/DatabaseContext';
import { TRAIT_CATEGORIES } from '../../../lib/ai/traits';
import { firstName } from '../../../lib/gender';
import { buildGeneralCommentPrompt } from '../../../lib/ai/prompts';
import { extractJsonArray, generateWithGemini } from '../../../lib/ai/geminiClient';
import { weakSubjectsForStudent } from '../../../lib/reportMath';
import { getCoreScoredSubjects } from '../../../lib/programmeSchemas';
import { useUndo } from '../../../context/UndoContext';

import { useAuth } from '../../../context/AuthContext';

export default function GeneralCommentsAi() {
  const { currentUser } = useAuth();
  const { activeClass, classStudents } = useActiveClass();
  const { students, scores, summaries, saveSummaries } = useDatabase();
  const { push } = useUndo();
  const [studentId, setStudentId] = useState('');
  const [traits, setTraits] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');

  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : '';
  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const userId = currentUser?.id || (currentUser as any)?.uid;
  const isFormTeacher = Boolean(
    userId &&
      (userId === activeClass.teacherId ||
        userId === (activeClass as any).formTeacherId ||
        userId === (activeClass as any).formTeacherUid)
  );

  const activeStudentId = studentId || classStudents[0]?.id || '';
  const student = classStudents.find((s) => s.id === activeStudentId);

  const toggleTrait = (t: string) => {
    setTraits((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const generate = async () => {
    if (!student) return;
    setBusy(true);
    try {
      push({ type: 'summaries', before: summaries.map((s) => ({ ...s })) });
      const nameMap = Object.fromEntries(
        getCoreScoredSubjects(activeClass.programme).map((s) => [s.code, s.name])
      );
      const lowest = weakSubjectsForStudent(
        scores,
        student.id,
        activeClass.id,
        'EOT',
        termKey,
        nameMap
      );
      const prompt = buildGeneralCommentPrompt({
        name: firstName(student.name, activeClass.settings.nameFormat),
        gender: student.gender,
        traits: Array.from(traits),
        lowestSubjects: lowest,
      });
      const res = await generateWithGemini(prompt, true);
      const parsed = (Array.isArray(res.parsed) ? res.parsed : extractJsonArray(res.text)) as {
        id: string;
        comment: string;
      }[];
      const comment = parsed[0]?.comment || '';
      setPreview(comment);

      const existing = summaries.find(
        (s) =>
          s.studentId === student.id &&
          s.classId === activeClass.id &&
          s.mode === 'EOT' &&
          s.termKey === termKey
      );
      saveSummaries([
        {
          studentId: student.id,
          classId: activeClass.id,
          mode: 'EOT',
          termKey,
          rawScore: existing?.rawScore || 0,
          averageScore: existing?.averageScore || 0,
          aveGrade: existing?.aveGrade || 'U',
          bestMark: existing?.bestMark || 0,
          bestGrade: existing?.bestGrade || 'U',
          leastMark: existing?.leastMark || 0,
          leastGrade: existing?.leastGrade || 'U',
          rank: existing?.rank || 0,
          peComment: existing?.peComment || '',
          clubComment: existing?.clubComment || '',
          generalComment: comment,
          teacherName: activeClass.settings.teacherName,
          finalized: existing?.finalized || false,
        },
      ]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI General Comment</h1>
          <p className="text-sm text-slate-500">Traits-driven class teacher summary</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={activeStudentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setTraits(new Set());
              setPreview('');
            }}
          >
            {classStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !traits.size || !isFormTeacher}
            onClick={generate}
            className="rounded-lg bg-sais-red text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Generate Comment
          </button>
        </div>
      </div>

      {!isFormTeacher && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 font-medium">
          Only the assigned Form Teacher for this class can edit general and club comments.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-slate-950 text-slate-100 rounded-xl p-4 space-y-4 max-h-[70vh] overflow-y-auto border border-slate-800">
          {Object.entries(TRAIT_CATEGORIES).map(([cat, list]) => (
            <div key={cat}>
              <h3 className="text-sais-brown-light text-sm font-semibold mb-2">{cat}</h3>
              <div className="flex flex-wrap gap-2">
                {list.map((t) => (
                  <label
                    key={t}
                    className={`text-xs px-2 py-1 rounded border cursor-pointer ${
                      traits.has(t)
                        ? 'bg-sais-red/20 border-sais-red text-sais-brown-light'
                        : 'border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={traits.has(t)}
                      onChange={() => toggleTrait(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold mb-2">Preview</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap min-h-[160px]">
            {preview ||
              summaries.find(
                (s) =>
                  s.studentId === activeStudentId &&
                  s.classId === activeClass.id &&
                  s.mode === 'EOT' &&
                  s.termKey === termKey
              )?.generalComment ||
              'Select traits and generate…'}
          </p>
        </div>
      </div>
    </div>
  );
}
