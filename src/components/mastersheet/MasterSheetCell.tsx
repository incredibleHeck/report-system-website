import React, { useState, useEffect, useRef } from 'react';
import { isAcademicSubject } from '../../lib/programmeSchemas';
import { gradeFromTotal } from '../../lib/grading';

export interface MasterSheetSubjectCellProps {
  key?: string;
  sub: any;
  hit: any;
  ave: number;
  isReadOnlyMode: boolean;
  selectedTermView: string;
  upsertScores: (scores: any[]) => boolean | void;
  st: any;
  activeClass: any;
  mode: string;
  activeTermKey: string;
  year: string;
  rIdx: number;
  startColIdx: number;
  onKeyDownGrid: (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => void;
  t1Score?: number | null;
  t2Score?: number | null;
  t3Score?: number | null;
}

export const MasterSheetSubjectCell = React.memo(function MasterSheetSubjectCell({
  sub,
  hit,
  ave,
  isReadOnlyMode,
  selectedTermView,
  upsertScores,
  st,
  activeClass,
  mode,
  activeTermKey,
  year,
  rIdx,
  startColIdx,
  onKeyDownGrid,
  t1Score,
  t2Score,
  t3Score,
}: MasterSheetSubjectCellProps) {
  const isAcad = isAcademicSubject(sub.code, sub.kind);
  const isAnnual = selectedTermView === 'ANNUAL';

  const propCw = hit?.cwScaled ?? hit?.cwScore ?? '';
  const propMt = hit?.mtScaled ?? hit?.mtScore ?? '';
  const propEot = hit?.examScaled ?? hit?.eotScore ?? '';
  const propComment = hit?.comment || '';

  const [localCw, setLocalCw] = useState<string>(
    propCw !== '' && propCw !== null && propCw !== undefined ? String(propCw) : ''
  );
  const [localMt, setLocalMt] = useState<string>(
    propMt !== '' && propMt !== null && propMt !== undefined ? String(propMt) : ''
  );
  const [localEot, setLocalEot] = useState<string>(
    propEot !== '' && propEot !== null && propEot !== undefined ? String(propEot) : ''
  );
  const [localComment, setLocalComment] = useState<string>(propComment);

  const cwRef = useRef<HTMLInputElement>(null);
  const mtRef = useRef<HTMLInputElement>(null);
  const eotRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  // Sync prop changes ONLY when input element is NOT actively focused by teacher
  useEffect(() => {
    const isCwFocused = document.activeElement === cwRef.current;
    const isMtFocused = document.activeElement === mtRef.current;
    const isEotFocused = document.activeElement === eotRef.current;
    const isCommentFocused = document.activeElement === commentRef.current;

    const cw = hit?.cwScaled ?? hit?.cwScore ?? '';
    const mt = hit?.mtScaled ?? hit?.mtScore ?? '';
    const eot = hit?.examScaled ?? hit?.eotScore ?? '';
    const cmt = hit?.comment || '';

    if (!isCwFocused) setLocalCw(cw !== '' && cw !== null && cw !== undefined ? String(cw) : '');
    if (!isMtFocused) setLocalMt(mt !== '' && mt !== null && mt !== undefined ? String(mt) : '');
    if (!isEotFocused) setLocalEot(eot !== '' && eot !== null && eot !== undefined ? String(eot) : '');
    if (!isCommentFocused) setLocalComment(cmt);
  }, [hit, st.id, sub.code, selectedTermView]);

  const latestStateRef = useRef({ localCw, localMt, localEot, localComment, hit, isReadOnlyMode });
  useEffect(() => {
    latestStateRef.current = { localCw, localMt, localEot, localComment, hit, isReadOnlyMode };
  });

  const commitScoreChange = (type: 'cw' | 'mt' | 'eot') => {
    if (isReadOnlyMode) return;

    const rawVal = type === 'cw' ? localCw : type === 'mt' ? localMt : localEot;
    const currentPropVal =
      type === 'cw'
        ? (hit?.cwScaled ?? hit?.cwScore ?? '')
        : type === 'mt'
        ? (hit?.mtScaled ?? hit?.mtScore ?? '')
        : (hit?.examScaled ?? hit?.eotScore ?? '');

    if (String(rawVal) === String(currentPropVal)) return;

    const parseField = (valStr: string, fallback: number | null | undefined): number | null => {
      if (valStr.trim() === '') return null;
      const p = parseFloat(valStr);
      return isNaN(p) ? (fallback ?? null) : p;
    };

    let cwVal = parseField(localCw, hit?.cwScaled ?? hit?.cwScore);
    let mtVal = parseField(localMt, hit?.mtScaled ?? hit?.mtScore);
    let eotVal = parseField(localEot, hit?.examScaled ?? hit?.eotScore);

    if (cwVal !== null) cwVal = Math.min(20, Math.max(0, cwVal));
    if (mtVal !== null) mtVal = Math.min(20, Math.max(0, mtVal));
    if (eotVal !== null) {
      const maxEot = isAcad ? 60 : 100;
      eotVal = Math.min(maxEot, Math.max(0, eotVal));
    }

    const newTotal = Number(((cwVal ?? 0) + (mtVal ?? 0) + (eotVal ?? 0)).toFixed(1));
    const { grade: newGrade } = gradeFromTotal(newTotal);

    const ok = upsertScores([
      {
        studentId: st.id,
        studentKey: st.studentKey || st.id,
        classId: activeClass.id,
        subjectCode: sub.code,
        mode,
        termKey: activeTermKey,
        academicYear: year,
        cwScore: cwVal ?? 0,
        cwScaled: cwVal ?? 0,
        mtScore: mtVal ?? 0,
        mtScaled: mtVal ?? 0,
        eotScore: eotVal ?? 0,
        examScaled: eotVal ?? 0,
        totalScore: newTotal,
        grade: newGrade || 'U',
        comment: localComment || hit?.comment || '',
      },
    ]);

    if (ok === false) {
      alert('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
      setLocalCw(propCw !== '' && propCw !== null && propCw !== undefined ? String(propCw) : '');
      setLocalMt(propMt !== '' && propMt !== null && propMt !== undefined ? String(propMt) : '');
      setLocalEot(propEot !== '' && propEot !== null && propEot !== undefined ? String(propEot) : '');
      setLocalComment(propComment);
    }
  };

  const commitCommentChange = () => {
    if (isReadOnlyMode) return;
    if (localComment === (hit?.comment || '')) return;

    const cwVal = hit?.cwScaled ?? hit?.cwScore ?? 0;
    const mtVal = hit?.mtScaled ?? hit?.mtScore ?? 0;
    const eotVal = hit?.examScaled ?? hit?.eotScore ?? 0;
    const total = hit?.totalScore ?? Number((cwVal + mtVal + eotVal).toFixed(1));

    const ok = upsertScores([
      {
        studentId: st.id,
        studentKey: st.studentKey || st.id,
        classId: activeClass.id,
        subjectCode: sub.code,
        mode,
        termKey: activeTermKey,
        academicYear: year,
        cwScore: cwVal,
        cwScaled: cwVal,
        mtScore: mtVal,
        mtScaled: mtVal,
        eotScore: eotVal,
        examScaled: eotVal,
        totalScore: total,
        grade: hit?.grade ?? gradeFromTotal(total).grade ?? 'U',
        comment: localComment,
      },
    ]);

    if (ok === false) {
      alert('Security Block: Attempted to modify records in a locked term without Headteacher privileges.');
      setLocalComment(propComment);
    }
  };

  const commitRef = useRef({ commitScoreChange, commitCommentChange });
  useEffect(() => {
    commitRef.current = { commitScoreChange, commitCommentChange };
  });

  // Unmount cleanup handler: flush pending changes if component unmounts before blur
  useEffect(() => {
    return () => {
      const { localCw, localMt, localEot, localComment, hit, isReadOnlyMode } = latestStateRef.current;
      if (isReadOnlyMode) return;
      const pCw = hit?.cwScaled ?? hit?.cwScore ?? '';
      const pMt = hit?.mtScaled ?? hit?.mtScore ?? '';
      const pEot = hit?.examScaled ?? hit?.eotScore ?? '';
      const pCmt = hit?.comment || '';

      if (
        String(localCw) !== String(pCw) ||
        String(localMt) !== String(pMt) ||
        String(localEot) !== String(pEot)
      ) {
        commitRef.current.commitScoreChange('cw');
      } else if (localComment !== pCmt) {
        commitRef.current.commitCommentChange();
      }
    };
  }, []);

  const handleKeyDownWithCommit = (
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number,
    type: 'cw' | 'mt' | 'eot' | 'comment'
  ) => {
    if (type === 'comment') {
      commitCommentChange();
    } else {
      commitScoreChange(type);
    }
    onKeyDownGrid(e, r, c);
  };

  const totalScore = hit?.totalScore ?? '—';
  const grade = hit?.grade || '—';

  const inputStyle = `w-full rounded border px-1 py-0.5 text-xs text-center font-mono transition-all focus:outline-none focus:ring-1 focus:ring-red-600 ${
    isReadOnlyMode
      ? 'bg-slate-100/70 text-slate-500 cursor-default border-slate-200'
      : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
  }`;

  return (
    <tr className="contents">
      {isAcad ? (
        <>
          <td className="px-1 py-1 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
            <input
              ref={cwRef}
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={localCw}
              onChange={(e) => setLocalCw(e.target.value)}
              onBlur={() => commitScoreChange('cw')}
              onKeyDown={(e) => handleKeyDownWithCommit(e, rIdx, startColIdx, 'cw')}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-1 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
            <input
              ref={mtRef}
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx + 1}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={localMt}
              onChange={(e) => setLocalMt(e.target.value)}
              onBlur={() => commitScoreChange('mt')}
              onKeyDown={(e) => handleKeyDownWithCommit(e, rIdx, startColIdx + 1, 'mt')}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-1 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
            <input
              ref={eotRef}
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx + 2}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={localEot}
              onChange={(e) => setLocalEot(e.target.value)}
              onBlur={() => commitScoreChange('eot')}
              onKeyDown={(e) => handleKeyDownWithCommit(e, rIdx, startColIdx + 2, 'eot')}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-20">
            {totalScore}
          </td>
          <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-16">
            {grade}
          </td>
          <td className="px-2 py-1.5 align-middle border-r border-b border-slate-200 min-w-[160px]">
            <input
              ref={commentRef}
              type="text"
              data-row={rIdx}
              data-col={startColIdx + 3}
              readOnly={isReadOnlyMode}
              className={`w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                isReadOnlyMode ? 'bg-slate-100/70 text-slate-500 cursor-default' : ''
              }`}
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              onBlur={() => commitCommentChange()}
              onKeyDown={(e) => handleKeyDownWithCommit(e, rIdx, startColIdx + 3, 'comment')}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td
            className="w-16 text-center align-middle bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
            title={`Class Average: ${ave}`}
          >
            {ave}
          </td>
        </>
      ) : (
        <>
          <td className="px-1 py-1 text-center align-middle font-mono font-bold bg-slate-100 border-r border-b border-slate-300 w-20">
            <input
              ref={eotRef}
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={localEot || hit?.totalScore || ''}
              onChange={(e) => setLocalEot(e.target.value)}
              onBlur={() => commitScoreChange('eot')}
              onKeyDown={(e) => handleKeyDownWithCommit(e, rIdx, startColIdx, 'eot')}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-16">
            {grade}
          </td>
          <td className="px-2 py-1.5 align-middle border-r border-b border-slate-200 min-w-[180px]">
            <input
              ref={commentRef}
              type="text"
              data-row={rIdx}
              data-col={startColIdx + 1}
              readOnly={isReadOnlyMode}
              className={`w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                isReadOnlyMode ? 'bg-slate-100/70 text-slate-500 cursor-default' : ''
              }`}
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              onBlur={() => commitCommentChange()}
              onKeyDown={(e) => handleKeyDownWithCommit(e, rIdx, startColIdx + 1, 'comment')}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td
            className="w-16 text-center align-middle bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
            title={`Class Average: ${ave}`}
          >
            {ave}
          </td>
        </>
      )}
    </tr>
  );
});
