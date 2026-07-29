import React from 'react';
import { useMasterSheetData } from '../../hooks/useMasterSheetData';
import { MasterSheetHeader } from '../../components/mastersheet/MasterSheetHeader';
import { MasterSheetGrid } from '../../components/mastersheet/MasterSheetGrid';
import { useDatabase } from '../../context/DatabaseContext';

export default function MasterSheet() {
  const { upsertScores } = useDatabase();
  const data = useMasterSheetData();

  if (!data.activeClass) {
    return <p className="text-slate-500 font-medium p-4">No active class stream selected.</p>;
  }

  return (
    <div className="space-y-4 max-w-full">
      <MasterSheetHeader
        activeClass={data.activeClass}
        selectedAcademicYearId={data.selectedAcademicYearId}
        selectedTermView={data.selectedTermView}
        setSelectedTermView={data.setSelectedTermView}
        mode={data.mode}
        setMode={data.setMode}
        isReadOnlyMode={data.isReadOnlyMode}
        isHeadteacher={data.isHeadteacher}
        isFormTeacher={data.isFormTeacher}
        adminEditOverride={data.adminEditOverride}
        setAdminEditOverride={data.setAdminEditOverride}
        handleFinalize={data.handleFinalize}
      />

      <MasterSheetGrid
        classStudents={data.classStudents}
        allSubjects={data.allSubjects}
        subjectAverages={data.subjectAverages}
        selectedTermView={data.selectedTermView}
        publishedTermCodes={data.publishedTermCodes}
        analyticsMap={data.analyticsMap}
        currentClassScores={data.currentClassScores}
        generalComments={data.generalComments}
        peComments={data.peComments}
        clubComments={data.clubComments}
        isReadOnlyMode={data.isReadOnlyMode}
        isFormTeacher={data.isFormTeacher}
        setGeneralComments={data.setGeneralComments}
        setPeComments={data.setPeComments}
        setClubComments={data.setClubComments}
        upsertScores={upsertScores}
        activeTermKey={data.activeTermKey}
        year={data.academicYear}
        activeClass={data.activeClass}
        mode={data.mode}
      />
    </div>
  );
}
