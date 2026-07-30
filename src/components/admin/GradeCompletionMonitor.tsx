import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Lock, Unlock, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { useDatabase, useActiveClass, getStreamYearId, normalizeYearId } from '../../context/DatabaseContext';

export default function GradeCompletionMonitor() {
  const navigate = useNavigate();
  const { classes, users, enrollments, scores, summaries, finalizeReports, unfinalizeReports, selectedAcademicYearId } = useDatabase();
  const { setActiveClassId } = useActiveClass();

  const activeYearClasses = useMemo(() => {
    const normSelected = normalizeYearId(selectedAcademicYearId);
    return classes.filter(
      (cs) => normalizeYearId(getStreamYearId(cs)) === normSelected
    );
  }, [classes, selectedAcademicYearId]);

  const sortedClasses = useMemo(() => {
    return [...activeYearClasses].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeYearClasses]);

  const classStatusList = useMemo(() => {
    return sortedClasses.map((cls) => {
      const teacher = users.find((u) => u.id === cls.teacherId);
      const teacherName = teacher ? (teacher.name || teacher.email) : 'Unassigned';

      const classEnrs = enrollments.filter((e) => e.classId === cls.id);
      const studentCount = classEnrs.length;

      // Count scores for this class
      const classScores = scores.filter((s) => s.classId === cls.id && (s.totalScore ?? 0) > 0);
      
      // Expected scores: approx studentCount * subjects count
      const subjectCount = cls.subjectTeachers?.length || 8;
      const expectedTotal = studentCount * subjectCount;
      const progressPercent = expectedTotal > 0 
        ? Math.min(100, Math.round((classScores.length / expectedTotal) * 100))
        : 0;

      // Check summary finalized state
      const isFinalized = summaries.some((s) => s.classId === cls.id && (s.isFinalized || s.finalized));

      return {
        classId: cls.id,
        className: cls.name,
        programme: cls.programme,
        teacherName,
        studentCount,
        progressPercent,
        isFinalized,
      };
    });
  }, [sortedClasses, users, enrollments, scores, summaries]);

  const handleOpenClassMaster = (classId: string) => {
    setActiveClassId(classId);
    navigate('/teacher/master');
  };

  const handleToggleFinalize = (classId: string, currentFinalized: boolean) => {
    if (currentFinalized) {
      if (window.confirm('Are you sure you want to unfinalize this class Master Sheet? This will unlock edits for teachers.')) {
        unfinalizeReports(classId);
      }
    } else {
      finalizeReports(classId);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sais-black font-display flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sais-red" />
            School-Wide Grade Completion & Approval Monitor
          </h2>
          <p className="text-xs text-sais-muted mt-1">
            Real-time tracking of mark entry progress and Master Sheet finalization status across all 13 class streams
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Class Stream</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Programme</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Form Teacher</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Enrolled</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Mark Entry Progress</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Finalization Status</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {classStatusList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sais-muted text-sm italic">
                  No active class streams configured.
                </td>
              </tr>
            ) : (
              classStatusList.map((item) => (
                <tr
                  key={item.classId}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-sais-black">
                    {item.className}
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-700 border border-slate-200/60">
                      {item.programme}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {item.teacherName}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">
                    {item.studentCount} Students
                  </td>
                  <td className="py-3 px-4 min-w-[180px]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                        <span>{item.progressPercent}% Filled</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.progressPercent >= 90
                              ? 'bg-emerald-600'
                              : item.progressPercent >= 50
                              ? 'bg-amber-500'
                              : 'bg-sais-red'
                          }`}
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {item.isFinalized ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                        <Lock className="w-3.5 h-3.5" />
                        Finalized
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        In Progress
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenClassMaster(item.classId)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all inline-flex items-center gap-1 shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sais-red" />
                      View Master
                    </button>
                    <button
                      onClick={() => handleToggleFinalize(item.classId, item.isFinalized)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs ${
                        item.isFinalized
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                          : 'bg-emerald-700 text-white hover:bg-emerald-800'
                      }`}
                    >
                      {item.isFinalized ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          Unfinalize
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Finalize
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
