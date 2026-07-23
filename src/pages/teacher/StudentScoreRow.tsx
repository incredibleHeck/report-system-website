import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatScaledHint,
  hasRawEotData,
  scaleRawEotComponents,
  calculateScoreOnlyGrade,
} from '../../lib/grading';
import {
  RAW_SCORE_MAX,
  SCORE_FIELD_MAX,
  parseOptionalScore,
  sanitizeScoreInput,
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

function scoreInputClass(hasError: boolean) {
  return [
    'w-12 rounded border px-1.5 py-1 text-center text-sm font-mono font-medium bg-white text-sais-black transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red',
    hasError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 hover:border-slate-400',
  ].join(' ');
}

function toDraft(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(n);
}

function StudentScoreRow({
  studentId,
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

  const initialUseRaw = isEotScored && existing ? hasRawEotData(existing) : false;

  const [useRaw, setUseRaw] = useState(initialUseRaw);
  const [cwDraft, setCwDraft] = useState<string[]>(() =>
    (existing?.cwRaw ?? [null, null, null, null, null]).map(toDraft)
  );
  const [mtSplitDraft, setMtSplitDraft] = useState<string[]>(() =>
    (existing?.mtRawSplit ?? [null, null, null]).map(toDraft)
  );
  const [mtSingleDraft, setMtSingleDraft] = useState(() => toDraft(existing?.mtRawSingle));
  const [examDraft, setExamDraft] = useState(() => toDraft(existing?.examRaw));
  const [totalDraft, setTotalDraft] = useState(() =>
    existing?.totalScore != null && (kind === 'scoreOnly' || mode === 'MIDTERM')
      ? String(existing.totalScore)
      : ''
  );
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Reset local drafts when loaded score identity changes (term/mode/student data reload)
  useEffect(() => {
    const raw = existing ? hasRawEotData(existing) : false;
    setUseRaw(raw);
    setCwDraft((existing?.cwRaw ?? [null, null, null, null, null]).map(toDraft));
    setMtSplitDraft((existing?.mtRawSplit ?? [null, null, null]).map(toDraft));
    setMtSingleDraft(toDraft(existing?.mtRawSingle));
    setExamDraft(toDraft(existing?.examRaw));
    if (isSimpleScore) {
      setTotalDraft(existing?.totalScore != null ? String(existing.totalScore) : '');
    } else {
      setTotalDraft('');
    }
    setComment(existing?.comment ?? '');
    setFieldError(null);
    setErrorKey(null);
  }, [existing?.id, existing?.termKey, mode, studentId, isSimpleScore]);

  const scaledPreview = useMemo(() => {
    if (!isEotScored) return null;
    if (!useRaw) {
      return {
        cwExact: existing?.cwScore ?? 0,
        mtExact: existing?.mtScore ?? 0,
        eotExact: existing?.eotScore ?? 0,
        totalScore: existing?.totalScore ?? 0,
        grade: existing?.grade ?? '',
      };
    }
    const scaled = scaleRawEotComponents({
      cwRaw: cwDraft.map(parseOptionalScore),
      mtEntryMode,
      mtRawSplit: mtSplitDraft.map(parseOptionalScore),
      mtRawSingle: parseOptionalScore(mtSingleDraft),
      examRaw: parseOptionalScore(examDraft),
    });
    return scaled;
  }, [
    isEotScored,
    useRaw,
    existing,
    cwDraft,
    mtSplitDraft,
    mtSingleDraft,
    examDraft,
    mtEntryMode,
  ]);

  const commitEot = useCallback(
    (next: {
      useRaw: boolean;
      cwDraft: string[];
      mtSplitDraft: string[];
      mtSingleDraft: string;
      examDraft: string;
      comment: string;
    }) => {
      if (!isEotScored) return;

      if (!next.useRaw) {
        onCommitEot({
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
          comment: next.comment,
        });
        return;
      }

      const scaled = scaleRawEotComponents({
        cwRaw: next.cwDraft.map(parseOptionalScore),
        mtEntryMode,
        mtRawSplit: next.mtSplitDraft.map(parseOptionalScore),
        mtRawSingle: parseOptionalScore(next.mtSingleDraft),
        examRaw: parseOptionalScore(next.examDraft),
      });

      onCommitEot({
        studentId,
        useRaw: true,
        cwRaw: scaled.cwRaw,
        mtRawSplit: scaled.mtRawSplit,
        mtRawSingle: scaled.mtRawSingle,
        examRaw: scaled.examRaw,
        cwScore: scaled.cwExact,
        mtScore: scaled.mtExact,
        eotScore: scaled.eotExact,
        totalScore: scaled.totalScore,
        grade: scaled.grade,
        comment: next.comment,
      });
    },
    [isEotScored, mtEntryMode, onCommitEot, studentId, existing]
  );

  const activateRawAndSanitize = (
    key: string,
    raw: string,
    max: number,
    apply: (sanitized: string) => void
  ) => {
    const { value, error, reject } = sanitizeScoreInput(raw, max);
    if (reject) {
      setFieldError(error ?? `Enter a number from 0 to ${max}`);
      setErrorKey(key);
      return;
    }
    setFieldError(error ?? null);
    setErrorKey(error ? key : null);
    if (!useRaw && value !== '') setUseRaw(true);
    apply(value);
  };

  const onBlurCommitEot = () => {
    const activated =
      useRaw ||
      cwDraft.some((d) => d.trim() !== '') ||
      mtSplitDraft.some((d) => d.trim() !== '') ||
      mtSingleDraft.trim() !== '' ||
      examDraft.trim() !== '';
    if (activated && !useRaw) setUseRaw(true);
    commitEot({
      useRaw: activated,
      cwDraft,
      mtSplitDraft,
      mtSingleDraft,
      examDraft,
      comment,
    });
    setFieldError(null);
    setErrorKey(null);
  };

  const commitSimple = (totalStr: string, commentStr: string) => {
    const { totalScore, grade } = calculateScoreOnlyGrade(Number(totalStr) || 0);
    onCommitSimple({ studentId, totalScore, grade, comment: commentStr });
  };

  const displayTotal = isEotScored
    ? scaledPreview?.totalScore ?? 0
    : isSimpleScore
      ? totalDraft || '0'
      : '';
  const displayGrade = isEotScored
    ? scaledPreview?.grade ?? ''
    : isSimpleScore
      ? calculateScoreOnlyGrade(Number(totalDraft) || 0).grade
      : '';

  return (
    <tr
      className={
        highlighted
          ? 'bg-lime-100/70'
          : 'border-t border-slate-100 even:bg-sais-brown/5 hover:bg-sais-red/10 transition-colors duration-150'
      }
    >
      <td className="px-3 py-2 text-sais-muted text-xs align-middle font-mono">{index}</td>
      <td className="px-3 py-2 font-medium text-sais-black whitespace-nowrap align-middle">{name}</td>

      {isEotScored && (
        <>
          <td className="px-1 py-1.5 align-top" colSpan={5}>
            <div className="flex flex-wrap gap-1">
              {cwDraft.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="decimal"
                  aria-label={`Classwork ${i + 1} out of ${RAW_SCORE_MAX.cwSlot}`}
                  className={scoreInputClass(errorKey === `cw${i}`)}
                  value={val}
                  onChange={(e) =>
                    activateRawAndSanitize(`cw${i}`, e.target.value, RAW_SCORE_MAX.cwSlot, (v) => {
                      setCwDraft((prev) => {
                        const next = [...prev];
                        next[i] = v;
                        return next;
                      });
                    })
                  }
                  onBlur={onBlurCommitEot}
                  title={`CW${i + 1}: 0–${RAW_SCORE_MAX.cwSlot}`}
                />
              ))}
            </div>
            {useRaw && scaledPreview && (
              <p className="text-[10px] text-sais-muted font-mono mt-0.5">
                [Scaled: {formatScaledHint(scaledPreview.cwExact, SCORE_FIELD_MAX.cw)}]
              </p>
            )}
            {!useRaw && existing?.cwScore != null && (
              <p className="text-[10px] text-amber-700 font-mono mt-0.5">
                Legacy: {formatScaledHint(existing.cwScore, SCORE_FIELD_MAX.cw)}
              </p>
            )}
          </td>

          {mtEntryMode === 'split' ? (
            <td className="px-1 py-1.5 align-top" colSpan={3}>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    [0, RAW_SCORE_MAX.mtA, 'A'],
                    [1, RAW_SCORE_MAX.mtB, 'B'],
                    [2, RAW_SCORE_MAX.mtC, 'C'],
                  ] as const
                ).map(([i, max, label]) => (
                  <input
                    key={label}
                    type="text"
                    inputMode="decimal"
                    aria-label={`Midterm ${label} out of ${max}`}
                    className={scoreInputClass(errorKey === `mt${i}`)}
                    value={mtSplitDraft[i] ?? ''}
                    onChange={(e) =>
                      activateRawAndSanitize(`mt${i}`, e.target.value, max, (v) => {
                        setMtSplitDraft((prev) => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        });
                      })
                    }
                    onBlur={onBlurCommitEot}
                    title={`MT ${label}: 0–${max}`}
                  />
                ))}
              </div>
              {useRaw && scaledPreview && (
                <p className="text-[10px] text-sais-muted font-mono mt-0.5">
                  [Scaled: {formatScaledHint(scaledPreview.mtExact, SCORE_FIELD_MAX.mt)}]
                </p>
              )}
              {!useRaw && existing?.mtScore != null && (
                <p className="text-[10px] text-amber-700 font-mono mt-0.5">
                  Legacy: {formatScaledHint(existing.mtScore, SCORE_FIELD_MAX.mt)}
                </p>
              )}
            </td>
          ) : (
            <td className="px-1 py-1.5 align-top">
              <input
                type="text"
                inputMode="decimal"
                aria-label={`Midterm out of ${RAW_SCORE_MAX.mtSingle}`}
                className={scoreInputClass(errorKey === 'mtSingle')}
                value={mtSingleDraft}
                onChange={(e) =>
                  activateRawAndSanitize(
                    'mtSingle',
                    e.target.value,
                    RAW_SCORE_MAX.mtSingle,
                    setMtSingleDraft
                  )
                }
                onBlur={onBlurCommitEot}
                title={`MT: 0–${RAW_SCORE_MAX.mtSingle}`}
              />
              {useRaw && scaledPreview && (
                <p className="text-[10px] text-sais-muted font-mono mt-0.5">
                  [Scaled: {formatScaledHint(scaledPreview.mtExact, SCORE_FIELD_MAX.mt)}]
                </p>
              )}
              {!useRaw && existing?.mtScore != null && (
                <p className="text-[10px] text-amber-700 font-mono mt-0.5">
                  Legacy: {formatScaledHint(existing.mtScore, SCORE_FIELD_MAX.mt)}
                </p>
              )}
            </td>
          )}

          <td className="px-1 py-1.5 align-top">
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Exam out of ${RAW_SCORE_MAX.exam}`}
              className={scoreInputClass(errorKey === 'exam')}
              value={examDraft}
              onChange={(e) =>
                activateRawAndSanitize('exam', e.target.value, RAW_SCORE_MAX.exam, setExamDraft)
              }
              onBlur={onBlurCommitEot}
              title={`Exam: 0–${RAW_SCORE_MAX.exam}`}
            />
            {useRaw && scaledPreview && (
              <p className="text-[10px] text-sais-muted font-mono mt-0.5">
                [Scaled: {formatScaledHint(scaledPreview.eotExact, SCORE_FIELD_MAX.eot)}]
              </p>
            )}
            {!useRaw && existing?.eotScore != null && (
              <p className="text-[10px] text-amber-700 font-mono mt-0.5">
                Legacy: {formatScaledHint(existing.eotScore, SCORE_FIELD_MAX.eot)}
              </p>
            )}
            {fieldError && (
              <p className="text-[10px] text-rose-600 mt-0.5 max-w-[6rem]">{fieldError}</p>
            )}
          </td>
        </>
      )}

      {kind !== 'commentOnly' && (
        <td className="px-2 py-1.5 text-center align-middle font-medium">
          {isEotScored ? (
            <div className="inline-flex items-center justify-center min-w-[2.75rem] px-2 py-1 rounded bg-sais-brown/10 border border-sais-brown/20 font-bold font-mono text-sais-black text-sm">
              {displayTotal}
            </div>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Total out of ${SCORE_FIELD_MAX.total}`}
              className={scoreInputClass(errorKey === 'total')}
              value={totalDraft}
              onChange={(e) => {
                const { value, error, reject } = sanitizeScoreInput(
                  e.target.value,
                  SCORE_FIELD_MAX.total
                );
                if (reject) {
                  setFieldError(error ?? '');
                  setErrorKey('total');
                  return;
                }
                setFieldError(error ?? null);
                setErrorKey(error ? 'total' : null);
                setTotalDraft(value);
              }}
              onBlur={() => {
                commitSimple(totalDraft, comment);
                setFieldError(null);
                setErrorKey(null);
              }}
            />
          )}
        </td>
      )}

      {kind !== 'commentOnly' && (
        <td className="px-3 py-2 text-center align-middle">
          {displayGrade ? (
            <span className="inline-block px-2.5 py-0.5 rounded bg-sais-black text-sais-white text-xs font-bold font-mono shadow-xs">
              {displayGrade}
            </span>
          ) : (
            <span className="text-sais-muted text-xs">—</span>
          )}
        </td>
      )}

      <td className="px-2 py-1.5 min-w-[200px] align-middle">
        <input
          className="w-full rounded border border-slate-300 px-2.5 py-1 text-sm bg-white text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => {
            if (isEotScored) {
              const activated =
                useRaw ||
                cwDraft.some((d) => d.trim() !== '') ||
                mtSplitDraft.some((d) => d.trim() !== '') ||
                mtSingleDraft.trim() !== '' ||
                examDraft.trim() !== '';
              if (activated && !useRaw) setUseRaw(true);
              commitEot({
                useRaw: activated,
                cwDraft,
                mtSplitDraft,
                mtSingleDraft,
                examDraft,
                comment,
              });
            } else if (kind !== 'commentOnly') {
              commitSimple(totalDraft, comment);
            } else {
              onCommitSimple({ studentId, totalScore: 0, grade: '', comment });
            }
          }}
          placeholder="Comment..."
        />
      </td>
    </tr>
  );
}

export default memo(StudentScoreRow);
