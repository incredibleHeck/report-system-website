import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { parseAcademicYear } from '../../lib/academicYear';
import { getSubjectByCode } from '../../lib/programmeSchemas';
import { scaleRawEotComponents } from '../../lib/grading';
import { RAW_SCORE_MAX, SCORE_FIELD_MAX } from '../../lib/scoreValidation';
import type { AssessmentScore, MtEntryMode } from '../../types';
import StudentScoreRow, {
  type EotRowCommit,
  type SimpleRowCommit,
} from './StudentScoreRow';

type CommittedRow = {
  studentId: string;
  useRaw: boolean;
  cwRaw: [number | null, number | null, number | null, number | null, number | null];
  mtRawSplit: [number | null, number | null, number | null];
  mtRawSingle: number | null;
  examRaw: number | null;
  cwScore: number;
  mtScore: number;
  eotScore: number;
  totalScore: number;
  grade: string;
  comment: string;
};

function emptyCommit(studentId: string, existing?: AssessmentScore): CommittedRow {
  return {
    studentId,
    useRaw: false,
    cwRaw: [null, null, null, null, null],
    mtRawSplit: [null, null, null],
    mtRawSingle: null,
    examRaw: null,
    cwScore: existing?.cwScore ?? 0,
    mtScore: existing?.mtScore ?? 0,
    eotScore: existing?.eotScore ?? 0,
    totalScore: existing?.totalScore ?? 0,
    grade: existing?.grade ?? '',
    comment: existing?.comment ?? '',
  };
}

export default function SubjectGrid() {
  const { code = '' } = useParams();
  const { activeClass, classStudents } = useActiveClass();
  const { scores, upsertScores, subjectContexts, saveSubjectContext } = useDatabase();
  const [mode, setMode] = useState<'EOT' | 'MIDTERM'>('EOT');
  const [mtEntryMode, setMtEntryMode] = useState<MtEntryMode>('split');
  const [ctxGrade, setCtxGrade] = useState('');
  const [ctxTopics, setCtxTopics] = useState('');
  const [showCtx, setShowCtx] = useState(false);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [committed, setCommitted] = useState<Record<string, CommittedRow>>({});

  const subject = activeClass ? getSubjectByCode(activeClass.programme, code) : undefined;
  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : 'DEFAULT';
  const existing = useMemo(() => {
    const map = new Map<string, AssessmentScore>();
    if (!activeClass) return map;
    for (const s of scores) {
      if (
        s.classId === activeClass.id &&
        s.subjectCode === code &&
        s.mode === mode &&
        s.termKey === termKey
      ) {
        map.set(s.studentId, s);
      }
    }
    return map;
  }, [scores, activeClass, code, mode, termKey]);

  useEffect(() => {
    if (!activeClass) return;
    const next: Record<string, CommittedRow> = {};
    let inferredMode: MtEntryMode | null = null;
    for (const st of classStudents) {
      const hit = existing.get(st.id);
      next[st.id] = emptyCommit(st.id, hit);
      if (hit?.mtEntryMode && !inferredMode) inferredMode = hit.mtEntryMode;
      if (hit && (hit.cwRaw || hit.examRaw != null || hit.mtRawSingle != null || hit.mtRawSplit)) {
        next[st.id] = {
          studentId: st.id,
          useRaw: true,
          cwRaw: hit.cwRaw ?? [null, null, null, null, null],
          mtRawSplit: hit.mtRawSplit ?? [null, null, null],
          mtRawSingle: hit.mtRawSingle ?? null,
          examRaw: hit.examRaw ?? null,
          cwScore: hit.cwScore ?? 0,
          mtScore: hit.mtScore ?? 0,
          eotScore: hit.eotScore ?? 0,
          totalScore: hit.totalScore,
          grade: hit.grade,
          comment: hit.comment ?? '',
        };
      } else if (hit) {
        next[st.id] = {
          ...emptyCommit(st.id, hit),
          totalScore: hit.totalScore,
          grade: hit.grade,
          comment: hit.comment ?? '',
        };
      }
    }
    setCommitted(next);
    if (inferredMode) setMtEntryMode(inferredMode);
    setHighlight(new Set());
    const ctx = subjectContexts.find(
      (c) => c.classId === activeClass.id && c.subjectCode === code
    );
    setCtxGrade(ctx?.gradeBand || '');
    setCtxTopics(ctx?.topics.join(', ') || '');
  }, [activeClass?.id, code, mode, classStudents.length, existing.size]);

  const onCommitEot = useCallback((row: EotRowCommit) => {
    setCommitted((prev) => ({ ...prev, [row.studentId]: row }));
  }, []);

  const onCommitSimple = useCallback((row: SimpleRowCommit) => {
    setCommitted((prev) => ({
      ...prev,
      [row.studentId]: {
        ...(prev[row.studentId] ?? emptyCommit(row.studentId)),
        studentId: row.studentId,
        totalScore: row.totalScore,
        grade: row.grade,
        comment: row.comment,
      },
    }));
  }, []);

  if (!activeClass || !subject) {
    return <p className="text-slate-500">Subject not found for active class.</p>;
  }

  const saveAll = () => {
    const payload: Omit<AssessmentScore, 'id'>[] = classStudents.map((st) => {
      const r = committed[st.id] ?? emptyCommit(st.id, existing.get(st.id));
      const academicYear = parseAcademicYear(activeClass.settings.termYearInfo);

      if (subject.kind === 'commentOnly') {
        return {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: code,
          mode,
          termKey,
          academicYear,
          totalScore: 0,
          grade: '',
          comment: r.comment || '',
        };
      }

      if (subject.kind === 'scoreOnly' || mode === 'MIDTERM') {
        return {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: code,
          mode,
          termKey,
          academicYear,
          totalScore: r.totalScore,
          grade: r.grade,
          comment: r.comment || '',
        };
      }

      // EOT scored: force header mtEntryMode onto every row; re-scale raw with that mode
      if (!r.useRaw) {
        return {
          studentId: st.id,
          classId: activeClass.id,
          subjectCode: code,
          mode,
          termKey,
          academicYear,
          mtEntryMode,
          cwScore: r.cwScore,
          mtScore: r.mtScore,
          eotScore: r.eotScore,
          totalScore: r.totalScore,
          grade: r.grade,
          comment: r.comment || '',
        };
      }

      const scaled = scaleRawEotComponents({
        cwRaw: r.cwRaw,
        mtEntryMode,
        mtRawSplit: r.mtRawSplit,
        mtRawSingle: r.mtRawSingle,
        examRaw: r.examRaw,
      });

      return {
        studentId: st.id,
        classId: activeClass.id,
        subjectCode: code,
        mode,
        termKey,
        academicYear,
        mtEntryMode,
        cwRaw: scaled.cwRaw,
        mtRawSplit: mtEntryMode === 'split' ? scaled.mtRawSplit : [null, null, null],
        mtRawSingle: mtEntryMode === 'single' ? scaled.mtRawSingle : null,
        examRaw: scaled.examRaw,
        cwScore: scaled.cwExact,
        mtScore: scaled.mtExact,
        eotScore: scaled.eotExact,
        totalScore: scaled.totalScore,
        grade: scaled.grade,
        comment: r.comment || '',
      };
    });
    upsertScores(payload);
    setHighlight(new Set(classStudents.map((s) => s.id)));
    alert('Scores saved (upserted)');
  };

  const saveContext = () => {
    saveSubjectContext({
      classId: activeClass.id,
      subjectCode: code,
      gradeBand: ctxGrade,
      topics: ctxTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setShowCtx(false);
  };

  const isEotScored = subject.kind === 'scored' && mode === 'EOT';
  const mtColSpan = mtEntryMode === 'split' ? 3 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{subject.name}</h1>
          <p className="text-sm text-slate-500">
            {activeClass.name} · {subject.kind}
          </p>
          {isEotScored && (
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              CW each /{RAW_SCORE_MAX.cwSlot} (×5) · Midterm{' '}
              {mtEntryMode === 'split'
                ? `${RAW_SCORE_MAX.mtA}+${RAW_SCORE_MAX.mtB}+${RAW_SCORE_MAX.mtC}`
                : `/${RAW_SCORE_MAX.mtSingle}`}{' '}
              · Exam /{RAW_SCORE_MAX.exam} → scaled to {SCORE_FIELD_MAX.cw}+{SCORE_FIELD_MAX.mt}+
              {SCORE_FIELD_MAX.eot}. Empty cells count as 0.
            </p>
          )}
          {(subject.kind === 'scoreOnly' || mode === 'MIDTERM') && subject.kind !== 'commentOnly' && (
            <p className="text-xs text-slate-500 mt-1">
              Max marks: Total {SCORE_FIELD_MAX.total}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'EOT' | 'MIDTERM')}
          >
            <option value="EOT">EOT</option>
            <option value="MIDTERM">Midterm</option>
          </select>
          {isEotScored && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={mtEntryMode}
              onChange={(e) => setMtEntryMode(e.target.value as MtEntryMode)}
              aria-label="Midterm entry mode"
            >
              <option value="split">Midterm: Split (30+30+40)</option>
              <option value="single">Midterm: Single (/100)</option>
            </select>
          )}
          <button
            onClick={() => setShowCtx(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Subject Context
          </button>
          <button
            onClick={saveAll}
            className="rounded-lg bg-sais-red text-sais-white px-4 py-2 text-sm hover:bg-sais-red-dark"
          >
            Save Marks
          </button>
        </div>
      </div>

      <div className="@container overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Student</th>
              {isEotScored && (
                <>
                  <th className="px-2 py-2 text-center" colSpan={5}>
                    CW /{RAW_SCORE_MAX.cwSlot} each
                  </th>
                  <th className="px-2 py-2 text-center" colSpan={mtColSpan}>
                    {mtEntryMode === 'split'
                      ? `MT ${RAW_SCORE_MAX.mtA}/${RAW_SCORE_MAX.mtB}/${RAW_SCORE_MAX.mtC}`
                      : `MT /${RAW_SCORE_MAX.mtSingle}`}
                  </th>
                  <th className="px-2 py-2 text-center">Exam /{RAW_SCORE_MAX.exam}</th>
                </>
              )}
              {subject.kind !== 'commentOnly' && (
                <th className="px-3 py-2">Total/{SCORE_FIELD_MAX.total}</th>
              )}
              {subject.kind !== 'commentOnly' && <th className="px-3 py-2">Grade</th>}
              <th className="px-3 py-2 text-left">Comment</th>
            </tr>
          </thead>
          <tbody>
            {classStudents.map((st) => (
              <StudentScoreRow
                key={`${st.id}-${mode}-${mtEntryMode}`}
                studentId={st.id}
                index={st.index}
                name={st.name}
                kind={subject.kind}
                mode={mode}
                mtEntryMode={mtEntryMode}
                existing={existing.get(st.id)}
                highlighted={highlight.has(st.id)}
                onCommitEot={onCommitEot}
                onCommitSimple={onCommitSimple}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showCtx && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-slate-950 text-slate-100 rounded-xl p-5 w-full max-w-md space-y-3 border border-slate-700">
            <h3 className="font-semibold text-sais-brown-light">Set Subject Context</h3>
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              placeholder="Grade band e.g. Year 5"
              value={ctxGrade}
              onChange={(e) => setCtxGrade(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm min-h-[100px]"
              placeholder="Topics covered (comma-separated)"
              value={ctxTopics}
              onChange={(e) => setCtxTopics(e.target.value)}
            />
            <p className="text-xs text-sais-brown-light">
              {ctxTopics.split(',').filter((t) => t.trim()).length} topics
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCtx(false)} className="px-3 py-2 text-sm text-slate-400">
                Cancel
              </button>
              <button onClick={saveContext} className="px-3 py-2 text-sm rounded-lg bg-sais-red">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
