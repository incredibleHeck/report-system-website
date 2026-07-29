import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isAcademicSubject } from '../../lib/programmeSchemas';
import { toCanonicalTermKey } from '../../lib/academicYear';
import { MasterSheetSubjectCell } from './MasterSheetCell';

interface MasterSheetGridProps {
  classStudents: any[];
  allSubjects: any[];
  subjectAverages: Record<string, number>;
  selectedTermView: string;
  publishedTermCodes: string[];
  analyticsMap: Record<string, any>;
  currentClassScores: any[];
  generalComments: Record<string, string>;
  peComments: Record<string, string>;
  clubComments: Record<string, string>;
  isReadOnlyMode: boolean;
  isFormTeacher: boolean;
  setGeneralComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPeComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setClubComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  upsertScores: (scores: any[]) => void;
  activeTermKey: string;
  year: string;
  activeClass: any;
  mode: string;
}

export function MasterSheetGrid({
  classStudents,
  allSubjects,
  subjectAverages,
  selectedTermView,
  publishedTermCodes,
  analyticsMap,
  currentClassScores,
  generalComments,
  peComments,
  clubComments,
  isReadOnlyMode,
  isFormTeacher,
  setGeneralComments,
  setPeComments,
  setClubComments,
  upsertScores,
  activeTermKey,
  year,
  activeClass,
  mode,
}: MasterSheetGridProps) {
  const navigate = useNavigate();
  const isAnnual = selectedTermView === 'ANNUAL';

  // Compute column offset start indices for each subject in the row
  const colOffsets: number[] = [];
  let currentColCount = 0;
  
  if (isAnnual) {
    currentColCount = 3;
  } else {
    allSubjects.forEach((sub) => {
      colOffsets.push(currentColCount);
      const isAcad = isAcademicSubject(sub.code, sub.kind);
      currentColCount += isAcad ? 4 : 2;
    });
  }
  const totalSubjectCols = currentColCount;
  const totalCols = totalSubjectCols + 3; // General, PE, Club comments
  const totalRows = classStudents.length;

  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number
  ) => {
    let targetRow = r;
    let targetCol = c;

    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }

    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        if (e.key === 'Enter' && e.shiftKey) {
          targetRow = Math.max(0, r - 1);
        } else {
          targetRow = Math.min(totalRows - 1, r + 1);
        }
        e.preventDefault();
        break;

      case 'ArrowUp':
        targetRow = Math.max(0, r - 1);
        e.preventDefault();
        break;

      case 'Tab':
        if (e.shiftKey) {
          targetCol = Math.max(0, c - 1);
        } else {
          targetCol = Math.min(totalCols - 1, c + 1);
        }
        e.preventDefault();
        break;

      case 'ArrowRight':
        if (
          e.currentTarget.selectionStart === e.currentTarget.value.length &&
          e.currentTarget.selectionEnd === e.currentTarget.value.length
        ) {
          targetCol = Math.min(totalCols - 1, c + 1);
          e.preventDefault();
        }
        break;

      case 'ArrowLeft':
        if (
          e.currentTarget.selectionStart === 0 &&
          e.currentTarget.selectionEnd === 0
        ) {
          targetCol = Math.max(0, c - 1);
          e.preventDefault();
        }
        break;

      default:
        return;
    }

    if (targetRow !== r || targetCol !== c) {
      const nextInput = document.querySelector<HTMLInputElement>(
        `input[data-row="${targetRow}"][data-col="${targetCol}"]`
      );
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  return (
    <div className={`overflow-x-auto rounded-lg shadow-xs border border-slate-200 bg-white max-h-[75vh] scrollbar-thin scrollbar-thumb-slate-300 ${isAnnual ? 'w-full max-w-5xl' : 'min-w-[2600px]'}`}>
      <table className={`${isAnnual ? 'w-full' : 'min-w-[2600px]'} text-xs border-collapse`}>
        <thead>
          <tr className="bg-red-900 text-white font-bold font-display uppercase tracking-wider text-center text-xs select-none sticky top-0 z-30 shadow-2xs">
            <th
              colSpan={isAnnual ? 3 : 4}
              className="py-2.5 px-3 border-r border-red-950/40 text-center sticky left-0 z-30 bg-red-950"
            >
              STUDENT IDENTIFIERS ({classStudents.length} Students)
            </th>
            {isAnnual ? (
              <th colSpan={3} className="py-2.5 px-3 border-r border-red-950/40 text-center bg-amber-900">
                TERM RAW SCORES FROM MASTER SHEETS (3 TERMS)
              </th>
            ) : (
              allSubjects.map((sub) => (
                <th
                  key={`group-${sub.code}`}
                  colSpan={isAcademicSubject(sub.code, sub.kind) ? 7 : 4}
                  className="py-2.5 px-3 border-r border-red-950/40 text-center"
                >
                  {sub.name} ({sub.code})
                </th>
              ))
            )}
            <th colSpan={isAnnual ? 2 : 9} className="py-2.5 px-3 border-r border-red-950/40 text-center">
              STREAM SUMMARY & ANALYTICS ({isAnnual ? `Annual Cumulative (${publishedTermCodes.length} Published Terms)` : selectedTermView})
            </th>
            {!isAnnual && (
              <th colSpan={4} className="py-2.5 px-3 text-center">
                FORM TEACHER REMARKS & OVERALL COMMENTS
              </th>
            )}
          </tr>

          <tr className="bg-slate-100 font-semibold border-b border-r border-slate-300 text-slate-700 text-xs select-none sticky top-9 z-30">
            <th className="sticky left-0 z-30 bg-slate-100 text-left px-2 py-2 border-r border-b border-slate-300 w-14">
              Index No.
            </th>
            <th className="sticky left-14 z-30 bg-slate-100 text-left px-2 py-2 border-r border-b border-slate-300 w-32">
              Student ID
            </th>
            <th className={`sticky left-[184px] z-30 bg-slate-100 text-left px-3 py-2 border-b border-slate-300 w-52 min-w-[208px] ${isAnnual ? 'border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]' : 'border-r'}`}>
              Student Name
            </th>
            {!isAnnual && (
              <th className="sticky left-[392px] z-30 bg-slate-100 text-left px-3 py-2 border-r-2 border-b border-slate-300 w-36 min-w-[144px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                Assigned Club
              </th>
            )}

            {isAnnual ? (
              <>
                <th className="w-24 text-center px-2 py-2 border-r border-b border-slate-300 bg-amber-100/80 font-bold text-amber-950">
                  TERM 1 RAW
                </th>
                <th className="w-24 text-center px-2 py-2 border-r border-b border-slate-300 bg-amber-100/80 font-bold text-amber-950">
                  TERM 2 RAW
                </th>
                <th className="w-24 text-center px-2 py-2 border-r border-b border-slate-300 bg-amber-100/80 font-bold text-amber-950">
                  TERM 3 RAW
                </th>
              </>
            ) : (
              allSubjects.map((sub) => {
                const isAcad = isAcademicSubject(sub.code, sub.kind);
                return (
                  <React.Fragment key={`cols-${sub.code}`}>
                    {isAcad ? (
                      <>
                        <th className="w-16 text-center px-1 py-2 border-r border-b border-slate-200">
                          {sub.abbr} CW 20
                        </th>
                        <th className="w-16 text-center px-1 py-2 border-r border-b border-slate-200">
                          {sub.abbr} MT 20
                        </th>
                        <th className="w-16 text-center px-1 py-2 border-r border-b border-slate-200">
                          {sub.abbr} EOT 60
                        </th>
                        <th className="w-20 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} EOT 100
                        </th>
                        <th className="w-16 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} GRADE
                        </th>
                        <th className="min-w-[160px] text-left px-2 py-2 border-r border-b border-slate-200">
                          {sub.abbr} COMMENT
                        </th>
                        <th
                          className="w-16 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
                          title={`Class Average: ${subjectAverages[sub.code] || 0}`}
                        >
                          {sub.abbr} AVE
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="w-20 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} EOT 100
                        </th>
                        <th className="w-16 text-center bg-slate-200/80 font-bold border-r border-b border-slate-300 text-slate-900">
                          {sub.abbr} GRADE
                        </th>
                        <th className="min-w-[180px] text-left px-2 py-2 border-r border-b border-slate-200">
                          {sub.abbr} COMMENT
                        </th>
                        <th
                          className="w-16 text-center bg-amber-100/70 font-bold border-r border-b border-slate-300 text-amber-900"
                          title={`Class Average: ${subjectAverages[sub.code] || 0}`}
                        >
                          {sub.abbr} AVE
                        </th>
                      </>
                    )}
                  </React.Fragment>
                );
              })
            )}

            <th className="w-24 text-center bg-red-900 text-white font-bold border-r border-b border-red-950/40">
              {isAnnual ? 'CUMULATIVE RAW' : 'RAW SCORE'}
            </th>
            {!isAnnual && (
              <>
                <th className="w-24 text-center bg-amber-100/90 text-amber-950 font-bold border-r border-b border-slate-300">
                  AVERAGE SCORE
                </th>
                <th className="w-16 text-center bg-slate-200/80 text-slate-900 font-bold border-r border-b border-slate-300">
                  AVE GRADE
                </th>
                <th className="w-20 text-center border-r border-b border-slate-200">BEST MARK</th>
                <th className="w-16 text-center border-r border-b border-slate-200">BEST GRADE</th>
                <th className="w-20 text-center border-r border-b border-slate-200">LEAST MARK</th>
                <th className="w-16 text-center border-r border-b border-slate-200">LEAST GRADE</th>
                <th className="w-20 text-center border-r border-b border-slate-200">ATTENDANCE</th>
              </>
            )}
            <th className="w-20 text-center bg-red-900 text-white font-extrabold border-r border-b border-red-950/40">
              {isAnnual ? 'ANNUAL RANK' : 'RANK'}
            </th>

            {!isAnnual && (
              <>
                <th className="min-w-[280px] text-left px-3 py-2 border-r border-b border-slate-300">
                  CLASS TEACHER'S COMMENT
                </th>
                <th className="min-w-[220px] text-left px-3 py-2 border-r border-b border-slate-300">
                  PE COMMENT
                </th>
                <th className="min-w-[220px] text-left px-3 py-2 border-r border-b border-slate-300">
                  CLUB COMMENT
                </th>
                <th className="w-44 text-left px-3 py-2 border-b border-slate-300">
                  CLASS TEACHER’S NAME
                </th>
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {classStudents.map((st, idx) => {
            const analytics = analyticsMap[st.id] || {
              rawScore: 0,
              averageScore: 0,
              aveGrade: 'U',
              bestMark: 0,
              bestGrade: 'U',
              leastMark: 0,
              leastGrade: 'U',
              rank: 0,
              formattedRank: '-',
            };

            const clubScore = currentClassScores.find(
              (x) =>
                (x.studentId === st.id || x.studentKey === st.studentKey || x.studentId === st.studentKey) &&
                (x.subjectCode === 'CLUB' || x.subjectCode === 'CLUBS')
            );
            const assignedClub = st.clubName || clubScore?.clubName || 'Unassigned';

            const generalCommentReadOnly = isReadOnlyMode || !isFormTeacher;

            return (
              <tr
                key={st.id}
                className="group/row border-t border-slate-200 hover:bg-red-50/30 transition-colors duration-150"
              >
                <td className="px-2 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap align-middle sticky left-0 z-20 bg-white group-focus-within/row:bg-red-50/60 border-r border-b border-slate-300 w-14 transition-colors">
                  {st.index || String(idx + 1).padStart(3, '0')}
                </td>

                <td className="px-2 py-2 font-mono font-semibold text-slate-600 whitespace-nowrap align-middle sticky left-14 z-20 bg-white group-focus-within/row:bg-red-50/60 border-r border-b border-slate-300 w-32 transition-colors">
                  {st.studentKey || st.studentId || st.id}
                </td>

                <td
                  onClick={() => navigate(`/transcripts?studentKey=${st.studentKey || st.id}`)}
                  className={`px-3 py-2 font-semibold text-slate-900 whitespace-nowrap align-middle sticky left-[184px] z-20 bg-white group-focus-within/row:bg-red-50/60 border-b border-slate-300 w-52 transition-colors cursor-pointer hover:underline hover:text-red-700 ${isAnnual ? 'border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]' : 'border-r'}`}
                  title="Click to view full student transcript"
                >
                  {st.name}
                </td>

                {!isAnnual && (
                  <td className="px-3 py-2 font-semibold text-red-900 bg-red-50/40 whitespace-nowrap align-middle sticky left-[392px] z-20 group-focus-within/row:bg-red-100/60 border-r-2 border-b border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] w-36 transition-colors">
                    {assignedClub}
                  </td>
                )}

                {isAnnual ? (
                  <>
                    <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50/70 text-amber-950 border-r border-b border-slate-300 w-24">
                      {analytics.t1Raw ?? 0}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50/70 text-amber-950 border-r border-b border-slate-300 w-24">
                      {analytics.t2Raw ?? 0}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50/70 text-amber-950 border-r border-b border-slate-300 w-24">
                      {analytics.t3Raw ?? 0}
                    </td>
                  </>
                ) : (
                  allSubjects.map((sub, subIdx) => {
                    const hit = currentClassScores.find(
                      (x) =>
                        (x.studentKey === st.studentKey ||
                          x.studentKey === st.id ||
                          x.studentId === st.id ||
                          x.studentId === st.studentKey ||
                          (x as any).legacyStudentId === st.studentId ||
                          (x as any).legacyStudentId === st.id) &&
                        x.subjectCode === sub.code
                    );
                    const ave = subjectAverages[sub.code] || 0;

                    return (
                      <MasterSheetSubjectCell
                        key={`cell-${sub.code}`}
                        sub={sub}
                        hit={hit}
                        ave={ave}
                        isReadOnlyMode={isReadOnlyMode}
                        selectedTermView={selectedTermView}
                        upsertScores={upsertScores}
                        st={st}
                        activeClass={activeClass}
                        mode={mode}
                        activeTermKey={activeTermKey}
                        year={year}
                        rIdx={idx}
                        startColIdx={colOffsets[subIdx]}
                        onKeyDownGrid={handleGridKeyDown}
                      />
                    );
                  })
                )}

                <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-slate-100 text-slate-900 border-r border-b border-slate-300 w-24">
                  {analytics.rawScore}
                </td>
                {!isAnnual && (
                  <>
                    <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-900 border-r border-b border-slate-300 w-24 shadow-[inset_0_0_8px_rgba(0,0,0,0.03)]">
                      {analytics.averageScore}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono font-bold bg-amber-50 text-amber-900 border-r border-b border-slate-300 w-16">
                      {analytics.aveGrade}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-20">
                      {analytics.bestMark}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
                      {analytics.bestGrade}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-20">
                      {analytics.leastMark}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-16">
                      {analytics.leastGrade}
                    </td>
                    <td className="px-2 py-2 text-center align-middle font-mono border-r border-b border-slate-200 w-20">
                      {st.attendance ?? 60}
                    </td>
                  </>
                )}
                <td className="px-2 py-2 text-center align-middle font-mono font-extrabold text-red-900 bg-red-50/50 border-r border-b border-slate-300 w-20">
                  {analytics.formattedRank || analytics.rank || '-'}
                </td>

                {!isAnnual && (
                  <>
                    <td className="px-3 py-1.5 align-middle border-r border-b border-slate-300 min-w-[280px] focus-within:bg-red-50/40 transition-colors">
                      <input
                        data-row={idx}
                        data-col={totalSubjectCols}
                        readOnly={generalCommentReadOnly}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, totalSubjectCols)}
                        onFocus={(e) => e.target.select()}
                        className={`w-full rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all ${
                          generalCommentReadOnly
                            ? 'bg-slate-100/70 text-slate-400 cursor-default'
                            : 'bg-white text-slate-900'
                        }`}
                        value={generalComments[st.id] || ''}
                        onChange={(e) => {
                          if (generalCommentReadOnly) return;
                          setGeneralComments((prev) => ({ ...prev, [st.id]: e.target.value }));
                        }}
                        placeholder={
                          isReadOnlyMode
                            ? 'Locked term view'
                            : isFormTeacher
                              ? 'Class teacher overall comment...'
                              : 'Locked for Form Teacher'
                        }
                      />
                    </td>

                    <td className="px-3 py-1.5 align-middle border-r border-b border-slate-300 min-w-[220px] focus-within:bg-red-50/40 transition-colors">
                      <input
                        data-row={idx}
                        data-col={totalSubjectCols + 1}
                        readOnly={generalCommentReadOnly}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, totalSubjectCols + 1)}
                        onFocus={(e) => e.target.select()}
                        className={`w-full rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all ${
                          generalCommentReadOnly
                            ? 'bg-slate-100/70 text-slate-400 cursor-default'
                            : 'bg-white text-slate-900'
                        }`}
                        value={peComments[st.id] || ''}
                        onChange={(e) => {
                          if (generalCommentReadOnly) return;
                          setPeComments((prev) => ({ ...prev, [st.id]: e.target.value }));
                        }}
                        placeholder={
                          isReadOnlyMode
                            ? 'Locked term view'
                            : isFormTeacher
                              ? 'PE evaluation comment...'
                              : 'Locked for Form Teacher'
                        }
                      />
                    </td>

                    <td className="px-3 py-1.5 align-middle border-r border-b border-slate-300 min-w-[220px] focus-within:bg-red-50/40 transition-colors">
                      <input
                        data-row={idx}
                        data-col={totalSubjectCols + 2}
                        readOnly={generalCommentReadOnly}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, totalSubjectCols + 2)}
                        onFocus={(e) => e.target.select()}
                        className={`w-full rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all ${
                          generalCommentReadOnly
                            ? 'bg-slate-100/70 text-slate-400 cursor-default'
                            : 'bg-white text-slate-900'
                        }`}
                        value={clubComments[st.id] || ''}
                        onChange={(e) => {
                          if (generalCommentReadOnly) return;
                          setClubComments((prev) => ({ ...prev, [st.id]: e.target.value }));
                        }}
                        placeholder={
                          isReadOnlyMode
                            ? 'Locked term view'
                            : isFormTeacher
                              ? 'Club activity comment...'
                              : 'Locked for Form Teacher'
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-xs font-semibold text-slate-800 align-middle border-b border-slate-300 w-44 truncate">
                      {activeClass.settings.teacherName || 'Form Teacher'}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
