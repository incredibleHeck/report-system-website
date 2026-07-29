import React from 'react';
import { isAcademicSubject } from '../../lib/programmeSchemas';
import { gradeFromTotal } from '../../lib/grading';

export interface MasterSheetSubjectCellProps {
  key?: string;
  sub: any;
  hit: any;
  ave: number;
  isReadOnlyMode: boolean;
  selectedTermView: string;
  upsertScores: (scores: any[]) => void;
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

export function MasterSheetSubjectCell({
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

  if (isAnnual) {
    const raw1 = t1Score ?? 0;
    const raw2 = t2Score ?? 0;
    const raw3 = t3Score ?? 0;
    const totalRaw = Number(((t1Score ?? 0) + (t2Score ?? 0) + (t3Score ?? 0)).toFixed(1));
    
    // Count valid terms populated for annual average calculation
    let populatedCount = 0;
    if (t1Score !== undefined && t1Score !== null) populatedCount++;
    if (t2Score !== undefined && t2Score !== null) populatedCount++;
    if (t3Score !== undefined && t3Score !== null) populatedCount++;
    const count = populatedCount > 0 ? populatedCount : 1;
    const annualAvg = Number((totalRaw / count).toFixed(1));
    const annualGrade = gradeFromTotal(annualAvg).grade;

    return (
      <tr className="contents">
        <td className="px-1 py-2 text-center align-middle font-mono bg-slate-50 text-slate-700 border-r border-b border-slate-200 w-16">
          {t1Score !== undefined && t1Score !== null ? t1Score : '—'}
        </td>
        <td className="px-1 py-2 text-center align-middle font-mono bg-slate-50 text-slate-700 border-r border-b border-slate-200 w-16">
          {t2Score !== undefined && t2Score !== null ? t2Score : '—'}
        </td>
        <td className="px-1 py-2 text-center align-middle font-mono bg-slate-50 text-slate-700 border-r border-b border-slate-200 w-16">
          {t3Score !== undefined && t3Score !== null ? t3Score : '—'}
        </td>
        <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-900 border-r border-b border-slate-300 w-20">
          {totalRaw}
        </td>
        <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-20">
          {annualAvg}
        </td>
        <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-16">
          {annualGrade}
        </td>
        <td
          className="w-16 text-center align-middle bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
          title={`Class Average: ${ave}`}
        >
          {ave}
        </td>
      </tr>
    );
  }

  const cwVal = hit?.cwScaled ?? hit?.cwScore ?? '';
  const mtVal = hit?.mtScaled ?? hit?.mtScore ?? '';
  const eotVal = hit?.examScaled ?? hit?.eotScore ?? '';
  const totalScore = hit?.totalScore ?? '—';
  const grade = hit?.grade || '—';
  const comment = hit?.comment || '';

  const handleScoreChange = (type: 'cw' | 'mt' | 'eot', rawVal: string) => {
    if (isReadOnlyMode) return;

    let numVal = rawVal === '' ? 0 : parseFloat(rawVal);
    if (isNaN(numVal)) numVal = 0;

    let clampedCw = hit?.cwScaled ?? hit?.cwScore ?? 0;
    let clampedMt = hit?.mtScaled ?? hit?.mtScore ?? 0;
    let clampedEot = hit?.examScaled ?? hit?.eotScore ?? 0;

    if (type === 'cw') {
      clampedCw = Math.min(20, Math.max(0, numVal));
    } else if (type === 'mt') {
      clampedMt = Math.min(20, Math.max(0, numVal));
    } else if (type === 'eot') {
      const maxEot = isAcad ? 60 : 100;
      clampedEot = Math.min(maxEot, Math.max(0, numVal));
    }

    const newTotal = Number((clampedCw + clampedMt + clampedEot).toFixed(1));
    const { grade: newGrade } = gradeFromTotal(newTotal);

    upsertScores([
      {
        studentId: st.id,
        studentKey: st.studentKey || st.id,
        classId: activeClass.id,
        subjectCode: sub.code,
        mode,
        termKey: activeTermKey,
        academicYear: year,
        cwScore: clampedCw,
        cwScaled: clampedCw,
        mtScore: clampedMt,
        mtScaled: clampedMt,
        eotScore: clampedEot,
        examScaled: clampedEot,
        totalScore: newTotal,
        grade: newGrade || 'U',
        comment: hit?.comment || '',
      },
    ]);
  };

  const handleCommentChange = (updatedComment: string) => {
    if (isReadOnlyMode) return;
    upsertScores([
      {
        studentId: st.id,
        studentKey: st.studentKey || st.id,
        classId: activeClass.id,
        subjectCode: sub.code,
        mode,
        termKey: activeTermKey,
        academicYear: year,
        cwScore: hit?.cwScore ?? hit?.cwScaled ?? 0,
        cwScaled: hit?.cwScaled ?? hit?.cwScore ?? 0,
        mtScore: hit?.mtScore ?? hit?.mtScaled ?? 0,
        mtScaled: hit?.mtScaled ?? hit?.mtScore ?? 0,
        eotScore: hit?.eotScore ?? hit?.examScaled ?? 0,
        examScaled: hit?.examScaled ?? hit?.eotScore ?? 0,
        totalScore: hit?.totalScore ?? 0,
        grade: hit?.grade ?? 'U',
        comment: updatedComment,
      },
    ]);
  };

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
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={cwVal}
              onChange={(e) => handleScoreChange('cw', e.target.value)}
              onKeyDown={(e) => onKeyDownGrid(e, rIdx, startColIdx)}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-1 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
            <input
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx + 1}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={mtVal}
              onChange={(e) => handleScoreChange('mt', e.target.value)}
              onKeyDown={(e) => onKeyDownGrid(e, rIdx, startColIdx + 1)}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-1 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
            <input
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx + 2}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={eotVal}
              onChange={(e) => handleScoreChange('eot', e.target.value)}
              onKeyDown={(e) => onKeyDownGrid(e, rIdx, startColIdx + 2)}
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
              type="text"
              data-row={rIdx}
              data-col={startColIdx + 3}
              readOnly={isReadOnlyMode}
              className={`w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                isReadOnlyMode ? 'bg-slate-100/70 text-slate-500 cursor-default' : ''
              }`}
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              onKeyDown={(e) => onKeyDownGrid(e, rIdx, startColIdx + 3)}
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
              type="text"
              inputMode="decimal"
              data-row={rIdx}
              data-col={startColIdx}
              readOnly={isReadOnlyMode}
              className={inputStyle}
              value={eotVal || hit?.totalScore || ''}
              onChange={(e) => handleScoreChange('eot', e.target.value)}
              onKeyDown={(e) => onKeyDownGrid(e, rIdx, startColIdx)}
              onFocus={(e) => e.target.select()}
            />
          </td>
          <td className="px-1 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-16">
            {grade}
          </td>
          <td className="px-2 py-1.5 align-middle border-r border-b border-slate-200 min-w-[180px]">
            <input
              type="text"
              data-row={rIdx}
              data-col={startColIdx + 1}
              readOnly={isReadOnlyMode}
              className={`w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                isReadOnlyMode ? 'bg-slate-100/70 text-slate-500 cursor-default' : ''
              }`}
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              onKeyDown={(e) => onKeyDownGrid(e, rIdx, startColIdx + 1)}
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
}
