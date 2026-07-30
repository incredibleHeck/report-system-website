import { FormEvent, useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDatabase, getStreamYearId, normalizeYearId } from '../../context/DatabaseContext';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import type { User } from '../../types';
import AdminKpiHeader from '../../components/admin/AdminKpiHeader';
import GradeCompletionMonitor from '../../components/admin/GradeCompletionMonitor';
import TeacherManagementView from '../../components/admin/TeacherManagementView';
import SchoolBrandingSettings from '../../components/admin/SchoolBrandingSettings';
import AcademicYearManagementView from '../../components/admin/AcademicYearManagementView';
import StudentRegistryView from '../../components/registry/StudentRegistryView';
import ClassPromotionModal from '../../components/registry/ClassPromotionModal';
import BulkStudentImportModal from '../../components/registry/BulkStudentImportModal';
import { RefreshCw, Upload, LayoutDashboard, BarChart3, UserCheck, School as SchoolIcon, Users, Calendar, Settings } from 'lucide-react';

const getTeacherDisplayName = (t?: Partial<User> | null) => {
  if (!t) return '—';
  if (t.name && t.name.trim() !== '') return t.name;
  return t.email || '—';
};

const deduplicateByEmail = (list: User[]): User[] => {
  const map = new Map<string, User>();
  for (const u of list) {
    const key = (u.email || u.id || '').trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, u);
    } else {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...u,
        name: u.name && u.name.trim() !== '' ? u.name : existing.name,
        subjects: u.subjects && u.subjects.length > 0 ? u.subjects : existing.subjects,
      });
    }
  }
  return Array.from(map.values());
};

const sortTeachers = (list: User[]) =>
  deduplicateByEmail(list).sort((a, b) => {
    const nameA = a.name && a.name.trim() !== '' ? a.name : a.email || '';
    const nameB = b.name && b.name.trim() !== '' ? b.name : b.email || '';
    return nameA.localeCompare(nameB);
  });

type AdminTab = 'overview' | 'approvals' | 'teachers' | 'classes' | 'students' | 'years' | 'settings';

export default function HeadteacherDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tab: urlTab } = useParams();

  const {
    schools,
    users,
    classes,
    selectedAcademicYearId,
    assignSubjectTeacher,
    setFormTeacher,
    updateClassSettings,
    seedDemoData,
  } = useDatabase();

  const school =
    schools.find((s) => s.headteacherId === currentUser?.id) ||
    schools.find((s) => s.id === currentUser?.schoolId) ||
    schools[0];

  // Derive active tab from location pathname or urlTab
  const getActiveTabFromPath = (): AdminTab => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/headteacher/approvals')) return 'approvals';
    if (path.includes('/headteacher/teachers')) return 'teachers';
    if (path.includes('/headteacher/classes')) return 'classes';
    if (path.includes('/headteacher/students')) return 'students';
    if (path.includes('/headteacher/years')) return 'years';
    if (path.includes('/headteacher/settings')) return 'settings';
    if (urlTab && ['overview', 'approvals', 'teachers', 'classes', 'students', 'years', 'settings'].includes(urlTab)) {
      return urlTab as AdminTab;
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getActiveTabFromPath());

  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname, urlTab]);

  const handleTabChange = (tabKey: AdminTab) => {
    setActiveTab(tabKey);
    if (tabKey === 'overview') navigate('/headteacher');
    else navigate(`/headteacher/${tabKey}`);
  };

  const [isPromotionOpen, setIsPromotionOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const [manageClassId, setManageClassId] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectTeacherId, setSubjectTeacherId] = useState('');

  const isTeacherOrHeadteacher = (u: User) => u.role === 'teacher' || u.role === 'headteacher';
  const teachers = sortTeachers(users.filter((u) => isTeacherOrHeadteacher(u)));

  // Filter classes by active academic year
  const activeYearClasses = useMemo(() => {
    const normSelected = normalizeYearId(selectedAcademicYearId);
    return classes.filter(
      (cs) => normalizeYearId(getStreamYearId(cs)) === normSelected
    );
  }, [classes, selectedAcademicYearId]);

  // Classes sorted alphabetically
  const sortedClasses = useMemo(() => {
    return [...activeYearClasses].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeYearClasses]);

  const managedClass = sortedClasses.find((c) => c.id === manageClassId) || sortedClasses[0] || null;
  const manageSubjects = managedClass
    ? [...getSubjectsForTerm(managedClass.programme, managedClass.settings.termYearInfo)].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const handleFormTeacherChange = (classId: string, teacherId: string) => {
    if (!teacherId) return;
    setFormTeacher(classId, teacherId);
    const name = getTeacherDisplayName(teachers.find((t) => t.id === teacherId));
    if (name) updateClassSettings(classId, { teacherName: name });
  };

  const tabsConfig = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'approvals', label: 'Grade Approvals', icon: BarChart3 },
    { key: 'teachers', label: 'Staff Management', icon: UserCheck },
    { key: 'classes', label: 'Class Streams', icon: SchoolIcon },
    { key: 'students', label: 'Student Registry', icon: Users },
    { key: 'years', label: 'Academic Years', icon: Calendar },
    { key: 'settings', label: 'School Settings', icon: Settings },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-sais-black font-display flex items-center gap-2">
            SAIS Executive Portal & Admin Dashboard
          </h1>
          <p className="text-sais-muted text-sm mt-1">
            School governance, staffing allocations, grade approvals, and student registry
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsPromotionOpen(true)}
            className="rounded-xl bg-sais-red text-white px-4 py-2.5 text-xs font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Promote & Shuffle Classes
          </button>
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="rounded-xl bg-slate-800 text-white px-4 py-2.5 text-xs font-semibold hover:bg-black active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Bulk CSV Import
          </button>
          <button
            onClick={() => seedDemoData()}
            className="rounded-xl bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 text-xs font-semibold hover:bg-slate-200 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
          >
            Seed Demo Classes
          </button>
        </div>
      </div>

      {/* Top Executive KPI Header */}
      <AdminKpiHeader />

      {/* Segmented Admin Navigation Tabs Bar */}
      <div className="flex bg-slate-200/70 p-1.5 rounded-2xl gap-1 overflow-x-auto border border-slate-200 scrollbar-thin">
        {tabsConfig.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleTabChange(item.key as AdminTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-sais-red text-white shadow-xs scale-[1.01]'
                  : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Renderer */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <GradeCompletionMonitor />

          {/* Classes Overview Summary */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-sais-black text-lg font-display">Active Class Streams Overview ({sortedClasses.length} Streams)</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
                    <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Class</th>
                    <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Programme</th>
                    <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Form Teacher</th>
                    <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClasses.map((c) => {
                    const teacher = users.find((u) => u.id === c.teacherId);
                    return (
                      <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-sais-black">{c.name}</td>
                        <td className="py-2.5 px-4">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-sais-muted border border-slate-200/50">
                            {c.programme}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-sais-black">
                          {getTeacherDisplayName(teacher)}
                        </td>
                        <td className="py-2.5 px-4 text-sais-muted font-mono text-xs">
                          {getSubjectsForTerm(c.programme, c.settings.termYearInfo).length} subjects
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'approvals' && <GradeCompletionMonitor />}

      {activeTab === 'teachers' && <TeacherManagementView />}

      {activeTab === 'classes' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="font-bold text-sais-black text-lg font-display">Assign & Reassign Subject Teachers</h2>
            <p className="text-xs text-sais-muted mt-1">
              Changes cascade into active-year enrollments so both outgoing and incoming teachers retain transcript access.
            </p>
          </div>

          {!sortedClasses.length ? (
            <p className="text-sm text-sais-muted italic">Create or seed a class first.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-sais-muted mb-1.5">Class Stream</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                    value={managedClass?.id || ''}
                    onChange={(e) => {
                      setManageClassId(e.target.value);
                      setSubjectCode('');
                    }}
                  >
                    {sortedClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.programme})
                      </option>
                    ))}
                  </select>
                </div>
                {managedClass && (
                  <div>
                    <label className="block text-xs font-medium text-sais-muted mb-1.5">Form Teacher</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                      value={managedClass.teacherId}
                      onChange={(e) => handleFormTeacherChange(managedClass.id, e.target.value)}
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {getTeacherDisplayName(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {managedClass && (
                <form
                  className="grid sm:grid-cols-3 gap-3 items-end pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!subjectCode || !subjectTeacherId) return;
                    assignSubjectTeacher(managedClass.id, subjectCode, subjectTeacherId);
                    setSubjectCode('');
                    setSubjectTeacherId('');
                  }}
                >
                  <div>
                    <label className="block text-xs font-medium text-sais-muted mb-1.5">Subject</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                      value={subjectCode}
                      onChange={(e) => setSubjectCode(e.target.value)}
                      required
                    >
                      <option value="">Select subject</option>
                      {manageSubjects.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sais-muted mb-1.5">Subject Teacher</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red shadow-xs transition-all"
                      value={subjectTeacherId}
                      onChange={(e) => setSubjectTeacherId(e.target.value)}
                      required
                    >
                      <option value="">Select teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {getTeacherDisplayName(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-sais-red text-white px-4 py-2.5 text-sm font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs cursor-pointer"
                  >
                    Assign Subject Teacher
                  </button>
                </form>
              )}

              {managedClass && (
                <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
                        <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Subject</th>
                        <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Assigned Teacher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manageSubjects.map((s) => {
                        const asg = managedClass.subjectTeachers.find(
                          (st) => st.subjectCode === s.code
                        );
                        const teacher = users.find((u) => u.id === asg?.teacherId);
                        return (
                          <tr key={s.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3.5 font-medium text-sais-black">{s.name}</td>
                            <td className="py-2.5 px-3.5 text-sais-black">
                              {getTeacherDisplayName(teacher)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'students' && <StudentRegistryView />}

      {activeTab === 'years' && <AcademicYearManagementView />}

      {activeTab === 'settings' && <SchoolBrandingSettings />}

      {/* Stream Shuffling Class Promotion Modal */}
      <ClassPromotionModal
        isOpen={isPromotionOpen}
        onClose={() => setIsPromotionOpen(false)}
      />

      {/* Bulk CSV Import Modal */}
      <BulkStudentImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />
    </div>
  );
}
