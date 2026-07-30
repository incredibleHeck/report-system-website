import { useMemo } from 'react';
import { Users, School as SchoolIcon, CheckCircle2, Send, TrendingUp, ShieldCheck } from 'lucide-react';
import { useDatabase, getStreamYearId, normalizeYearId } from '../../context/DatabaseContext';

export default function AdminKpiHeader() {
  const { lifelongStudents, classes, summaries, contacts, users, selectedAcademicYearId } = useDatabase();

  const activeYearClasses = useMemo(() => {
    const normSelected = normalizeYearId(selectedAcademicYearId);
    return classes.filter(
      (cs) => normalizeYearId(getStreamYearId(cs)) === normSelected
    );
  }, [classes, selectedAcademicYearId]);

  // 1. Total Enrolled Students metrics
  const studentMetrics = useMemo(() => {
    const activeStudents = lifelongStudents.filter((s) => s.status === 'active');
    const maleCount = activeStudents.filter((s) => s.gender === 'Male').length;
    const femaleCount = activeStudents.filter((s) => s.gender === 'Female').length;
    return {
      total: activeStudents.length || lifelongStudents.length,
      male: maleCount,
      female: femaleCount,
    };
  }, [lifelongStudents]);

  // 2. Class Streams & Staffing Coverage metrics
  const staffingMetrics = useMemo(() => {
    if (activeYearClasses.length === 0) return { totalStreams: 0, staffedPercent: 0 };
    let fullyStaffedCount = 0;

    for (const c of activeYearClasses) {
      const hasFormTeacher = Boolean(c.teacherId && users.some((u) => u.id === c.teacherId));
      const hasSubjectTeachers = c.subjectTeachers && c.subjectTeachers.length > 0;
      if (hasFormTeacher && hasSubjectTeachers) {
        fullyStaffedCount++;
      }
    }
    const percent = Math.round((fullyStaffedCount / activeYearClasses.length) * 100);
    return {
      totalStreams: activeYearClasses.length,
      staffedPercent: isNaN(percent) ? 0 : percent,
    };
  }, [activeYearClasses, users]);

  // 3. Grade Entry Completion Rate
  const completionMetrics = useMemo(() => {
    if (activeYearClasses.length === 0) return { finalizedCount: 0, total: 0, percent: 0 };
    // Check finalized summaries
    const activeClassIds = new Set(activeYearClasses.map((c) => c.id));
    const finalizedClasses = new Set<string>();
    summaries.forEach((s) => {
      if ((s.isFinalized || s.finalized) && activeClassIds.has(s.classId)) {
        finalizedClasses.add(s.classId);
      }
    });

    const count = finalizedClasses.size;
    const total = activeYearClasses.length;
    const percent = Math.round((count / total) * 100);
    return {
      finalizedCount: count,
      total,
      percent: isNaN(percent) ? 0 : percent,
    };
  }, [activeYearClasses, summaries]);

  // 4. Report Delivery Health
  const deliveryMetrics = useMemo(() => {
    if (contacts.length === 0) return { deliveredCount: 0, total: 0, percent: 0 };
    const sentCount = contacts.filter((c) => c.status === 'Sent' || c.status === 'Delivered').length;
    const percent = Math.round((sentCount / contacts.length) * 100);
    return {
      deliveredCount: sentCount,
      total: contacts.length,
      percent: isNaN(percent) ? 0 : percent,
    };
  }, [contacts]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Total Enrolled Students */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
            Active Roster
          </span>
          <div className="w-9 h-9 rounded-xl bg-red-50 text-sais-red flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sais-black font-display tracking-tight">
              {studentMetrics.total}
            </span>
            <span className="text-xs font-semibold text-slate-500">Students</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-2">
            <span className="font-semibold text-slate-800">{studentMetrics.male} Male</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-800">{studentMetrics.female} Female</span>
          </p>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-sais-red rounded-full w-full" />
        </div>
      </div>

      {/* Metric 2: Staffing Coverage */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
            Staffing Coverage
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <SchoolIcon className="w-5 h-5" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sais-black font-display tracking-tight">
              {staffingMetrics.staffedPercent}%
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {staffingMetrics.totalStreams} Streams
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium text-slate-700">Form & Subject Teachers Assigned</span>
          </p>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${staffingMetrics.staffedPercent}%` }}
          />
        </div>
      </div>

      {/* Metric 3: Grade Entry Completion Rate */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
            Grade Finalization
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sais-black font-display tracking-tight">
              {completionMetrics.percent}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({completionMetrics.finalizedCount}/{completionMetrics.total} Streams)
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium text-slate-700">Master Sheets Finalized</span>
          </p>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${completionMetrics.percent}%` }}
          />
        </div>
      </div>

      {/* Metric 4: Report Delivery Health */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
            Delivery Health
          </span>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Send className="w-5 h-5" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sais-black font-display tracking-tight">
              {deliveryMetrics.percent}%
            </span>
            <span className="text-xs font-semibold text-slate-500">Dispatched</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            <span className="font-semibold text-slate-800">Email & WhatsApp</span> delivery rate
          </p>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${deliveryMetrics.percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
