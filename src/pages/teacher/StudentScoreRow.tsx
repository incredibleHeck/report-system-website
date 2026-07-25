import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateSubjectFinalScore,
  gradeFromTotal,
} from '../../lib/grading';
import {
  parseOptionalScore,
} from '../../lib/scoreValidation';
import type { AssessmentScore, MtEntryMode } from '../../types';

export type EotRowCommit = {
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

export type SimpleRowCommit = {
  studentId: string;
  totalScore: number;
  grade: string;
  comment: string;
};

type Props = {
  studentId: string;
  rowIndex: number;
  index: number | string;
  name: string;
  kind: 'scored' | 'scoreOnly' | 'commentOnly';
  mode: 'EOT' | 'MIDTERM';
  mtEntryMode: MtEntryMode;
  existing?: AssessmentScore;
  highlighted: boolean;
  onCommitEot: (row: EotRowCommit) => void;
  onCommitSimple: (row: SimpleRowCommit) => void;
};

function inputCellClass(hasError: boolean = false) {
  return [
    'w-12 mx-auto text-center font-mono text-xs rounded border py-1 bg-white text-slate-900 transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600',
    hasError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 hover:border-slate-400',
  ].join(' ');
}

function toDraft(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(n);
}

function StudentScoreRow({
  studentId,
  rowIndex,
  index,
  name,
  kind,
  mode,
  mtEntryMode,
  existing,
  highlighted,
  onCommitEot,
  onCommitSimple,
}: Props) {
  const isEotScored = kind === 'scored' && mode === 'EOT';
  const isSimpleScore = kind === 'scoreOnly' || mode === 'MIDTERM';

  const [cwDraft, setCwDraft] = useState<string[]>(() =>
    (existing?.cwRaw ?? [
      existing?.cw1 ?? null,
      existing?.cw2 ?? null,
      existing?.cw3 ?? null,
      existing?.cw4 ?? null,
      existing?.cw5 ?? null,
    ]).map(toDraft)
  );

  const [mtSplitDraft, setMtSplitDraft] = useState<string[]>(() =>
    (existing?.mtRawSplit ?? [
      existing?.mt1 ?? null,
      existing?.mt2 ?? null,
      existing?.mt3 ?? null,
    ]).map(toDraft)
  );

  const [mtSingleDraft, setMtSingleDraft] = useState(() =>
    toDraft(existing?.mtRawSingle ?? existing?.mt1)
  );

  const [examDraft, setExamDraft] = useState(() =>
    toDraft(existing?.examRaw ?? (existing as any)?.exam)
  );

  const [totalDraft, setTotalDraft] = useState(() =>
    existing?.totalScore != null && isSimpleScore ? String(existing.totalScore) : ''
  );

  const [comment, setComment] = useState(existing?.comment ?? '');

  useEffect(() => {
    setCwDraft(
      (existing?.cwRaw ?? [
        existing?.cw1 ?? null,
        existing?.cw2 ?? null,
        existing?.cw3 ?? null,
        existing?.cw4 ?? null,
        existing?.cw5 ?? null,
      ]).map(toDraft)
    );
    setMtSplitDraft(
      (existing?.mtRawSplit ?? [
        existing?.mt1 ?? null,
        existing?.mt2 ?? null,
        existing?.mt3 ?? null,
      ]).map(toDraft)
    );
    setMtSingleDraft(toDraft(existing?.mtRawSingle ?? existing?.mt1));
    setExamDraft(toDraft(existing?.examRaw ?? (existing as any)?.exam));
    if (isSimpleScore) {
      setTotalDraft(existing?.totalScore != null ? String(existing.totalScore) : '');
    } else {
      setTotalDraft('');
    }
    setComment(existing?.comment ?? '');
  }, [existing?.id, existing?.termKey, mode, studentId, isSimpleScore]);

  // Calculate live scores using SAIS calculation helper
  const calcResult = useMemo(() => {
    if (!isEotScored) return null;
    return calculateSubjectFinalScore({
      cw1: cwDraft[0],
      cw2: cwDraft[1],
      cw3: cwDraft[2],
      cw4: cwDraft[3],
      cw5: cwDraft[4],
      mtEntryMode,
      mt1: mtSplitDraft[0],
      mt2: mtSplitDraft[1],
      mt3: mtSplitDraft[2],
      mtSingle: mtSingleDraft,
      exam: examDraft,
    });
  }, [isEotScored, cwDraft, mtEntryMode, mtSplitDraft, mtSingleDraft, examDraft]);

  const commitEotNow = useCallback(() => {
    if (!isEotScored || !calcResult) return;

    const cwParsed: [number | null, number | null, number | null, number | null, number | null] = [
      parseOptionalScore(cwDraft[0]),
      parseOptionalScore(cwDraft[1]),
      parseOptionalScore(cwDraft[2]),
      parseOptionalScore(cwDraft[3]),
      parseOptionalScore(cwDraft[4]),
    ];

    const mtSplitParsed: [number | null, number | null, number | null] = [
      parseOptionalScore(mtSplitDraft[0]),
      parseOptionalScore(mtSplitDraft[1]),
      parseOptionalScore(mtSplitDraft[2]),
    ];

    const mtSingleParsed = parseOptionalScore(mtSingleDraft);
    const examParsed = parseOptionalScore(examDraft);

    onCommitEot({
      studentId,
      useRaw: true,
      cwRaw: cwParsed,
      mtRawSplit: mtSplitParsed,
      mtRawSingle: mtSingleParsed,
      examRaw: examParsed,
      cwScore: calcResult.cwScaled,
      mtScore: calcResult.mtScaled,
      eotScore: calcResult.examScaled,
      totalScore: calcResult.totalScore,
      grade: calcResult.grade,
      comment,
    });
  }, [
    isEotScored,
    calcResult,
    cwDraft,
    mtSplitDraft,
    mtSingleDraft,
    examDraft,
    comment,
    studentId,
    onCommitEot,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, colKey: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEotNow();
      const nextRow = rowIndex + 1;
      const target = document.querySelector<HTMLInputElement>(
        `input[data-row="${nextRow}"][data-col="${colKey}"]`
      );
      if (target) {
        target.focus();
        target.select();
      }
    }
  };

  const sanitizeInput = (val: string, max: number) => {
    if (val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    if (num < 0) return '0';
    if (num > max) return String(max);
    return val;
  };

  // Render Non-Scored Subject Row (PE / Clubs)
  if (kind === 'commentOnly') {
    return (
      <tr className="group/row border-b border-slate-200 hover:bg-red-50/30 transition-colors">
        <td className="sticky left-0 w-14 z-20 bg-white group-focus-within/row:bg-red-50/60 font-mono text-xs text-slate-500 px-3 py-2.5 border-r border-b border-slate-300 text-left transition-colors">
          {index}
        </td>
        <td className="sticky left-14 w-52 min-w-[208px] z-20 bg-white group-focus-within/row:bg-red-50/60 font-semibold text-xs text-slate-900 px-3 py-2.5 border-r-2 border-b border-slate-300 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] transition-colors">
          {name}
        </td>
        <td className="px-3 py-2 border-b border-slate-300 focus-within:bg-red-50/40 transition-colors" colSpan={2}>
          <input
            data-row={rowIndex}
            data-col="comment"
            className="w-full text-xs rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onCommitSimple({ studentId, totalScore: 0, grade: '', comment })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitSimple({ studentId, totalScore: 0, grade: '', comment });
                const nextRow = rowIndex + 1;
                const target = document.querySelector<HTMLInputElement>(
                  `input[data-row="${nextRow}"][data-col="comment"]`
                );
                if (target) {
                  target.focus();
                  target.select();
                }
              }
            }}
            placeholder="Enter evaluation / comment..."
          />
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={
        highlighted
          ? 'group/row bg-amber-100/60'
          : 'group/row border-b border-slate-200 hover:bg-red-50/30 transition-colors'
      }
    >
      {/* 1. STUDENT PROFILE (Frozen Sticky Left Columns) */}
      <td className="sticky left-0 w-14 z-20 bg-white group-focus-within/row:bg-red-50/60 font-mono text-xs text-slate-600 px-3 py-2 border-r border-b border-slate-200 text-left transition-colors">
        {index}
      </td>
      <td className="sticky left-14 w-52 min-w-[208px] z-20 bg-white group-focus-within/row:bg-red-50/60 font-semibold text-xs text-slate-900 px-3 py-2 border-r-2 border-b border-slate-300 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] transition-colors">
        {name}
      </td>

      {/* 2. CLASS ASSESSMENT (20%) */}
      {isEotScored && (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <td key={`cw-${i}`} className="w-16 px-1 py-1.5 border-r border-b border-slate-200 text-center focus-within:bg-red-50/40 transition-colors">
              <input
                type="text"
                inputMode="decimal"
                data-row={rowIndex}
                data-col={`cw${i}`}
                className={inputCellClass()}
                value={cwDraft[i] ?? ''}
                onChange={(e) => {
                  const sanitized = sanitizeInput(e.target.value, 10);
                  setCwDraft((prev) => {
                    const next = [...prev];
                    next[i] = sanitized;
                    return next;
                  });
                }}
                onBlur={commitEotNow}
                onKeyDown={(e) => handleKeyDown(e, `cw${i}`)}
                title={`CW ${i + 1}: 0–10`}
              />
            </td>
          ))}
          <td className="w-20 px-2 py-1.5 border-r border-b border-slate-300 text-center font-mono font-bold text-xs bg-slate-100 text-slate-800">
            {calcResult?.cwTotal ?? 0}
          </td>
          <td className="w-20 px-2 py-1.5 border-r border-b border-slate-300 text-center font-mono font-bold text-xs bg-amber-50/80 text-amber-900">
            {calcResult?.cwScaled ?? 0}
          </td>
        </>
      )}

      {/* 3. MIDTERM ASSESSMENT (20%) */}
      {isEotScored && (
        <>
          {mtEntryMode === 'split' ? (
            <>
              {[
                { idx: 0, max: 30, label: 'mt0' },
                { idx: 1, max: 30, label: 'mt1' },
                { idx: 2, max: 40, label: 'mt2' },
              ].map(({ idx, max, label }) => (
                <td key={label} className="w-20 px-1 py-1.5 border-r border-b border-slate-200 text-center focus-within:bg-red-50/40 transition-colors">
                  <input
                    type="text"
                    inputMode="decimal"
                    data-row={rowIndex}
                    data-col={label}
                    className={inputCellClass()}
                    value={mtSplitDraft[idx] ?? ''}
                    onChange={(e) => {
                      const sanitized = sanitizeInput(e.target.value, max);
                      setMtSplitDraft((prev) => {
                        const next = [...prev];
                        next[idx] = sanitized;
                        return next;
                      });
                    }}
                    onBlur={commitEotNow}
                    onKeyDown={(e) => handleKeyDown(e, label)}
                    title={`MT Test ${idx + 1}: 0–${max}`}
                  />
                </td>
              ))}
            </>
          ) : (
            <td className="w-20 px-1 py-1.5 border-r border-b border-slate-200 text-center focus-within:bg-red-50/40 transition-colors">
              <input
                type="text"
                inputMode="decimal"
                data-row={rowIndex}
                data-col="mtSingle"
                className="w-16 mx-auto text-center font-mono text-xs rounded border border-slate-300 py-1 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                value={mtSingleDraft}
                onChange={(e) => setMtSingleDraft(sanitizeInput(e.target.value, 100))}
                onBlur={commitEotNow}
                onKeyDown={(e) => handleKeyDown(e, 'mtSingle')}
                title="MT Exam: 0–100"
              />
            </td>
          )}
          <td className="w-20 px-2 py-1.5 border-r border-b border-slate-300 text-center font-mono font-bold text-xs bg-slate-100 text-slate-800">
            {calcResult?.mtRaw ?? 0}
          </td>
          <td className="w-20 px-2 py-1.5 border-r border-b border-slate-300 text-center font-mono font-bold text-xs bg-amber-50/80 text-amber-900">
            {calcResult?.mtScaled ?? 0}
          </td>
        </>
      )}

      {/* 4. EXAMINATION (60%) */}
      {isEotScored && (
        <>
          <td className="w-24 px-1 py-1.5 border-r border-b border-slate-200 text-center focus-within:bg-red-50/40 transition-colors">
            <input
              type="text"
              inputMode="decimal"
              data-row={rowIndex}
              data-col="exam"
              className="w-16 mx-auto text-center font-mono text-xs rounded border border-slate-300 py-1 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
              value={examDraft}
              onChange={(e) => setExamDraft(sanitizeInput(e.target.value, 100))}
              onBlur={commitEotNow}
              onKeyDown={(e) => handleKeyDown(e, 'exam')}
              title="Exam: 0–100"
            />
          </td>
          <td className="w-24 px-2 py-1.5 border-r border-b border-slate-300 text-center font-mono font-bold text-xs bg-amber-50/80 text-amber-900">
            {calcResult?.examScaled ?? 0}
          </td>
        </>
      )}

      {/* MIDTERM or ScoreOnly mode fallback columns */}
      {!isEotScored && isSimpleScore && (
        <td className="w-24 px-2 py-1.5 border-r border-b border-slate-300 text-center focus-within:bg-red-50/40 transition-colors">
          <input
            type="text"
            inputMode="decimal"
            data-row={rowIndex}
            data-col="total"
            className="w-16 mx-auto text-center font-mono text-xs rounded border border-slate-300 py-1 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
            value={totalDraft}
            onChange={(e) => setTotalDraft(sanitizeInput(e.target.value, 100))}
            onBlur={() => {
              const num = Number(totalDraft) || 0;
              const g = gradeFromTotal(num).grade;
              onCommitSimple({ studentId, totalScore: num, grade: g, comment });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const num = Number(totalDraft) || 0;
                const g = gradeFromTotal(num).grade;
                onCommitSimple({ studentId, totalScore: num, grade: g, comment });
                handleKeyDown(e, 'total');
              }
            }}
          />
        </td>
      )}

      {/* 5. TERM SUMMARY & COMMENTS */}
      <td className="w-24 px-2 py-1.5 border-r border-b border-slate-300 text-center font-mono font-extrabold text-sm bg-emerald-100/70 text-emerald-950">
        {isEotScored
          ? calcResult?.totalScore ?? 0
          : Number(totalDraft) || 0}
      </td>
      <td className="w-24 px-2 py-1.5 border-r border-b border-slate-300 text-center">
        <span className="inline-block px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-white">
          {isEotScored
            ? calcResult?.grade ?? 'U'
            : gradeFromTotal(Number(totalDraft) || 0).grade}
        </span>
      </td>
      <td className="min-w-[280px] px-2.5 py-1.5 border-b border-slate-300 focus-within:bg-red-50/40 transition-colors">
        <input
          type="text"
          data-row={rowIndex}
          data-col="comment"
          className="w-full text-xs rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => {
            if (isEotScored) commitEotNow();
            else onCommitSimple({ studentId, totalScore: Number(totalDraft) || 0, grade: gradeFromTotal(Number(totalDraft) || 0).grade, comment });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (isEotScored) commitEotNow();
              else onCommitSimple({ studentId, totalScore: Number(totalDraft) || 0, grade: gradeFromTotal(Number(totalDraft) || 0).grade, comment });
              handleKeyDown(e, 'comment');
            }
          }}
          placeholder="Teacher remarks..."
        />
      </td>
    </tr>
  );
}

export default memo(StudentScoreRow);
