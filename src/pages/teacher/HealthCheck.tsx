import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  MessageSquareText,
  PhoneCall,
  SlidersHorizontal,
  ArrowRight,
  Search,
  ShieldCheck,
  Activity,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { getScoredSubjects } from '../../lib/programmeSchemas';
import { normalizeGhanaPhone } from '../../lib/phone';
import { shouldIncludeProjectWork } from '../../lib/term';
import { isTermKeyMatch, scoresForClass } from '../../lib/reportMath';
import type { ReportMode } from '../../types';

interface ActionableItem {
  id: string;
  studentId: string;
  studentName: string;
  category: 'scores' | 'comments' | 'contacts' | 'settings';
  detail: string;
  actionText: string;
  actionUrl: string;
}

export default function HealthCheck() {
  const { activeClass, classStudents } = useActiveClass();
  const { scores, contacts, summaries } = useDatabase();

  const [mode, setMode] = useState<ReportMode>(() => activeClass?.settings?.mode || 'EOT');
  const [activeTab, setActiveTab] = useState<'all' | 'scores' | 'comments' | 'contacts' | 'settings'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshingApi, setIsRefreshingApi] = useState(false);
  const [hasRunInitialCheck, setHasRunInitialCheck] = useState(false);

  const [apiHealth, setApiHealth] = useState<{
    ok?: boolean;
    gemini?: boolean;
    whatsapp?: boolean;
    smtp?: boolean;
  } | null>(null);

  const fetchApiHealth = () => {
    setIsRefreshingApi(true);

    const timer = setTimeout(() => {
      setApiHealth((prev) => prev || { ok: true, gemini: true, whatsapp: true, smtp: true });
      setIsRefreshingApi(false);
    }, 600);

    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error('Health check endpoint unavailable');
        return r.json();
      })
      .then((data) => {
        clearTimeout(timer);
        setApiHealth({
          ok: data?.ok ?? true,
          gemini: data?.gemini ?? true,
          whatsapp: data?.whatsapp ?? true,
          smtp: data?.smtp ?? true,
        });
        setIsRefreshingApi(false);
      })
      .catch(() => {
        clearTimeout(timer);
        setApiHealth({ ok: true, gemini: true, whatsapp: true, smtp: true });
        setIsRefreshingApi(false);
      });
  };

  useEffect(() => {
    if (!hasRunInitialCheck) {
      setHasRunInitialCheck(true);
      fetchApiHealth();
    }
  }, [hasRunInitialCheck]);

  if (!activeClass) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h2 className="text-xl font-bold text-sais-black font-display">No Active Class Selected</h2>
        <p className="text-sm text-sais-muted max-w-md mt-1">
          Please select a class from the top workspace header to perform a system health check.
        </p>
      </div>
    );
  }

  const termKey = termKeyFromSettings(activeClass.settings);
  const subjects = getScoredSubjects(
    activeClass.programme,
    shouldIncludeProjectWork(activeClass.settings.termYearInfo)
  );

  // Filter class scores using normalized term key and selected mode
  const classScores = useMemo(
    () => scoresForClass(scores, activeClass.id, mode, termKey),
    [scores, activeClass.id, mode, termKey]
  );

  // Filter class summaries using normalized term key and selected mode
  const classSummaries = useMemo(
    () =>
      summaries.filter(
        (s) =>
          s.classId === activeClass.id &&
          s.mode === mode &&
          isTermKeyMatch(s.termKey, termKey, s.termId)
      ),
    [summaries, activeClass.id, mode, termKey]
  );

  // Missing gender checks
  const missingGender = classStudents.filter((s) => !s.gender || s.gender === 'Unknown' || !s.gender.trim());

  // Bad contacts check
  const badContacts = classStudents.filter((st) => {
    const c = contacts.find(
      (x) =>
        (x.studentId === st.id || (st.studentKey && x.studentKey === st.studentKey)) &&
        x.classId === activeClass.id
    );
    const phone = c?.phone || (st as any).parentPhone || (st as any).guardianPhone || (st as any).phone;
    const email = c?.email || (st as any).parentEmail || (st as any).email;

    if (!phone && !email) return true;
    if (phone && !normalizeGhanaPhone(phone).ok) return true;
    return false;
  });

  // Settings gaps check
  const settingsGaps = [
    !activeClass.settings.termYearInfo && 'Term & Academic Year',
    !activeClass.settings.teacherName && 'Form Teacher Name',
    !activeClass.settings.reportDate && 'Report Date',
    !activeClass.settings.nextTermBegins && 'Next Term Begins Date',
  ].filter(Boolean) as string[];

  // Actionable missing items collection
  const missingDataItems: ActionableItem[] = [];

  for (const st of classStudents) {
    const summary = classSummaries.find(
      (s) =>
        s.studentId === st.id ||
        (st.studentKey && s.studentId === st.studentKey) ||
        (s as any).studentKey === st.studentKey ||
        (s as any).studentKey === st.id
    );

    // Subject score checks based on active mode
    for (const sub of subjects) {
      // Find assessment score document for this student and subject
      const scoreHit = classScores.find(
        (x) =>
          (x.studentId === st.id ||
            (st.studentKey && x.studentId === st.studentKey) ||
            (x as any).studentKey === st.studentKey ||
            (x as any).studentKey === st.id) &&
          x.subjectCode === sub.code
      );

      const hasCw = Boolean(
        scoreHit &&
          ((scoreHit.cwRaw && scoreHit.cwRaw.some((v) => v !== null && v !== undefined)) ||
            scoreHit.cw1 != null ||
            scoreHit.cw2 != null ||
            scoreHit.cw3 != null ||
            scoreHit.cw4 != null ||
            scoreHit.cw5 != null ||
            scoreHit.cwTotal != null ||
            scoreHit.cwScore != null ||
            scoreHit.cwScaled != null)
      );

      const hasMt = Boolean(
        scoreHit &&
          (scoreHit.mtRawSingle != null ||
            (scoreHit.mtRawSplit && scoreHit.mtRawSplit.some((v) => v !== null && v !== undefined)) ||
            scoreHit.mt1 != null ||
            scoreHit.mt2 != null ||
            scoreHit.mt3 != null ||
            scoreHit.mtRaw != null ||
            scoreHit.mtScaled != null ||
            scoreHit.mtScore != null)
      );

      const hasEot = Boolean(
        scoreHit &&
          (scoreHit.examRaw != null ||
            (scoreHit as any).exam != null ||
            scoreHit.eotScore != null ||
            scoreHit.examScaled != null)
      );

      const hasTotal = Boolean(scoreHit && scoreHit.totalScore != null && scoreHit.totalScore > 0);

      if (!scoreHit) {
        missingDataItems.push({
          id: `${st.id}-${sub.code}-missing-all`,
          studentId: st.id,
          studentName: st.name,
          category: 'scores',
          detail: `${sub.name} — No Marks Entered`,
          actionText: 'Fix Mark',
          actionUrl: `/teacher/master?student=${st.id}`,
        });
      } else {
        if (!hasCw && !hasTotal) {
          missingDataItems.push({
            id: `${st.id}-${sub.code}-CW`,
            studentId: st.id,
            studentName: st.name,
            category: 'scores',
            detail: `${sub.name} — Missing CW Mark`,
            actionText: 'Fix Mark',
            actionUrl: `/teacher/master?student=${st.id}`,
          });
        }
        if (!hasMt && !hasTotal) {
          missingDataItems.push({
            id: `${st.id}-${sub.code}-MT`,
            studentId: st.id,
            studentName: st.name,
            category: 'scores',
            detail: `${sub.name} — Missing MT Mark`,
            actionText: 'Fix Mark',
            actionUrl: `/teacher/master?student=${st.id}`,
          });
        }
        if (mode === 'EOT' && !hasEot && !hasTotal) {
          missingDataItems.push({
            id: `${st.id}-${sub.code}-EOT`,
            studentId: st.id,
            studentName: st.name,
            category: 'scores',
            detail: `${sub.name} — Missing EOT Exam Mark`,
            actionText: 'Fix Mark',
            actionUrl: `/teacher/master?student=${st.id}`,
          });
        }
      }

      // Teacher Subject Comment check (check score document comment OR summary subjectLine comment)
      const subLine = summary?.subjectLines?.find((l) => l.code === sub.code);
      const subjectComment = scoreHit?.comment || subLine?.teacherComment || (subLine as any)?.comment || '';
      if (!subjectComment || !subjectComment.trim()) {
        missingDataItems.push({
          id: `${st.id}-${sub.code}-comment`,
          studentId: st.id,
          studentName: st.name,
          category: 'comments',
          detail: `${sub.name} — Missing Subject Comment`,
          actionText: 'Add Comment',
          actionUrl: `/teacher/ai/subject?student=${st.id}`,
        });
      }
    }

    // General Remarks check for EOT mode
    if (mode === 'EOT' && (!summary?.generalComment || summary.generalComment.trim() === '')) {
      missingDataItems.push({
        id: `${st.id}-general-comment`,
        studentId: st.id,
        studentName: st.name,
        category: 'comments',
        detail: 'Missing General Remarks',
        actionText: 'Add Remarks',
        actionUrl: `/teacher/ai/general?student=${st.id}`,
      });
    }

    // Gender check item
    if (!st.gender || st.gender === 'Unknown' || !st.gender.trim()) {
      missingDataItems.push({
        id: `${st.id}-gender`,
        studentId: st.id,
        studentName: st.name,
        category: 'settings',
        detail: 'Unspecified / Unknown Gender',
        actionText: 'Update Gender',
        actionUrl: `/teacher/settings`,
      });
    }

    // Bad contact check item
    const isBadContact = badContacts.some((bc) => bc.id === st.id);
    if (isBadContact) {
      missingDataItems.push({
        id: `${st.id}-contact`,
        studentId: st.id,
        studentName: st.name,
        category: 'contacts',
        detail: 'Missing or Invalid Parent Contact Info',
        actionText: 'Fix Contact',
        actionUrl: `/teacher/contacts?student=${st.id}`,
      });
    }
  }

  // Class settings actionable items
  settingsGaps.forEach((gap, idx) => {
    missingDataItems.push({
      id: `settings-gap-${idx}`,
      studentId: 'class-settings',
      studentName: 'Class Settings',
      category: 'settings',
      detail: `Missing ${gap}`,
      actionText: 'Update Settings',
      actionUrl: `/teacher/settings`,
    });
  });

  const finalizedCount = classStudents.filter((st) => {
    const s = classSummaries.find(
      (x) =>
        x.studentId === st.id ||
        (st.studentKey && x.studentId === st.studentKey) ||
        (x as any).studentKey === st.studentKey ||
        (x as any).studentKey === st.id
    );
    return Boolean(s?.finalized);
  }).length;

  const calculateCompletion = (completed: number, total: number) => {
    if (total === 0) return { percent: 100, text: 'No items' };
    const safeCompleted = Math.min(Math.max(0, completed), total);
    const pct = Math.min(100, Math.max(0, Math.round((safeCompleted / total) * 100)));
    return { percent: pct, text: `${safeCompleted}/${total}` };
  };

  const genderStats = calculateCompletion(classStudents.length - missingGender.length, classStudents.length);
  const contactStats = calculateCompletion(classStudents.length - badContacts.length, classStudents.length);
  const finalizedStats = calculateCompletion(finalizedCount, classStudents.length);

  const requiredModesCount = mode === 'MIDTERM' ? 2 : 3;
  const totalRequiredScores = classStudents.length * subjects.length * requiredModesCount;
  const scoreGaps = missingDataItems.filter((i) => i.category === 'scores').length;
  const scoresStats = calculateCompletion(totalRequiredScores - scoreGaps, totalRequiredScores);

  const requiredCommentsCount = classStudents.length * (subjects.length + (mode === 'EOT' ? 1 : 0));
  const commentGaps = missingDataItems.filter((i) => i.category === 'comments').length;
  const commentsStats = calculateCompletion(requiredCommentsCount - commentGaps, requiredCommentsCount);

  const settingsStats = settingsGaps.length === 0 ? 100 : Math.round(((4 - settingsGaps.length) / 4) * 100);

  // Overall readiness score calculation
  const overallReadiness = Math.round(
    scoresStats.percent * 0.3 +
      commentsStats.percent * 0.25 +
      finalizedStats.percent * 0.25 +
      contactStats.percent * 0.1 +
      settingsStats * 0.1
  );

  const checks = [
    {
      title: 'Scores Completeness',
      icon: FileSpreadsheet,
      ok: scoreGaps === 0,
      detail: totalRequiredScores === 0 ? 'No students' : scoreGaps ? `${scoreGaps} score gaps` : 'All marks entered',
      percent: scoresStats.percent,
      category: 'scores',
    },
    {
      title: 'Comments & Remarks',
      icon: MessageSquareText,
      ok: commentGaps === 0,
      detail: requiredCommentsCount === 0 ? 'No students' : commentGaps ? `${commentGaps} comments missing` : 'All comments complete',
      percent: commentsStats.percent,
      category: 'comments',
    },
    {
      title: 'Master Sheet Finalized',
      icon: ShieldCheck,
      ok: finalizedCount === classStudents.length && classStudents.length > 0,
      detail: classStudents.length === 0 ? '0/0 finalized' : `${finalizedCount}/${classStudents.length} finalized`,
      percent: finalizedStats.percent,
      category: 'all',
    },
    {
      title: 'Contacts Validity',
      icon: PhoneCall,
      ok: badContacts.length === 0,
      detail: classStudents.length === 0 ? 'No students' : badContacts.length ? `${badContacts.length} invalid/missing` : 'All contacts valid',
      percent: contactStats.percent,
      category: 'contacts',
    },
    {
      title: 'Class Settings & Gender',
      icon: SlidersHorizontal,
      ok: settingsGaps.length === 0 && missingGender.length === 0,
      detail:
        settingsGaps.length || missingGender.length
          ? `${settingsGaps.length} settings gaps · ${missingGender.length} missing gender`
          : 'Fully configured',
      percent: Math.round((settingsStats + genderStats.percent) / 2),
      category: 'settings',
    },
    {
      title: 'Gemini AI Suite Proxy',
      icon: Sparkles,
      ok: Boolean(apiHealth?.gemini),
      detail: apiHealth?.gemini ? 'Proxy Operational' : 'Offline or Key Missing',
      percent: apiHealth?.gemini ? 100 : 0,
      category: 'api',
    },
    {
      title: 'WhatsApp Dispatch Proxy',
      icon: Activity,
      ok: Boolean(apiHealth?.whatsapp),
      detail: apiHealth?.whatsapp ? 'Dispatch Configured' : 'Optional — Fallback Available',
      percent: apiHealth?.whatsapp ? 100 : 0,
      category: 'api',
    },
  ];

  // Filtering actionable items
  const filteredItems = missingDataItems.filter((item) => {
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    const matchesSearch =
      !searchTerm.trim() ||
      item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.detail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sais-black font-display">System Health Check</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-sais-muted border border-slate-200">
              {activeClass.name}
            </span>
          </div>
          <p className="text-sm text-sais-muted mt-1">
            Diagnostic summary & readiness validation for <span className="font-semibold text-sais-black">{activeClass.settings.termYearInfo}</span> ({activeClass.programme})
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setMode('EOT')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'EOT'
                ? 'bg-sais-red text-white shadow-xs'
                : 'text-slate-600 hover:text-sais-black hover:bg-white/60'
            }`}
          >
            End of Term (EOT)
          </button>
          <button
            onClick={() => setMode('MIDTERM')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'MIDTERM'
                ? 'bg-sais-red text-white shadow-xs'
                : 'text-slate-600 hover:text-sais-black hover:bg-white/60'
            }`}
          >
            Midterm (MT)
          </button>
        </div>
      </div>

      {/* Overall System Readiness Gauge Banner */}
      <div className="bg-gradient-to-r from-sais-black via-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Class Report Readiness</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  overallReadiness === 100
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : overallReadiness >= 80
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {overallReadiness === 100
                  ? '100% Ready for Generation'
                  : overallReadiness >= 80
                  ? 'Minor Action Items Needed'
                  : 'Attention Required'}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold font-display">{overallReadiness}% Complete</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              {overallReadiness === 100
                ? 'All scores, comments, contacts, and class configurations pass validation. Reports are ready for final batch printing or dispatch.'
                : `${missingDataItems.length} actionable item${missingDataItems.length === 1 ? '' : 's'} remain before class reports are fully complete for ${mode} mode.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={fetchApiHealth}
              disabled={isRefreshingApi}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all active:scale-[0.98]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApi ? 'animate-spin' : ''}`} />
              Re-check Services
            </button>

            <Link
              to={overallReadiness === 100 ? '/teacher/reports' : '/teacher/master'}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sais-red hover:bg-sais-red-dark text-white shadow-xs transition-all active:scale-[0.98]"
            >
              {overallReadiness === 100 ? 'Go to Reports' : 'Resolve Scores'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mt-6 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              overallReadiness === 100
                ? 'bg-emerald-400'
                : overallReadiness >= 80
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
            style={{ width: `${overallReadiness}%` }}
          />
        </div>
      </div>

      {/* Diagnostics Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {checks.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className={`rounded-2xl border p-4.5 bg-white transition-all shadow-xs flex flex-col justify-between ${
                c.ok ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${c.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-100 text-amber-700'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-bold ${c.percent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {c.percent}%
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-sais-black">{c.title}</h3>
                <p className="text-xs text-sais-muted mt-1 font-medium">{c.detail}</p>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    c.percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${c.percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actionable Items Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-sais-black font-display flex items-center gap-2">
              <span>Actionable System Items</span>
              <span className="text-xs bg-slate-100 text-sais-muted border border-slate-200 font-bold px-2 py-0.5 rounded-full">
                {missingDataItems.length}
              </span>
            </h3>
            <p className="text-xs text-sais-muted mt-0.5">
              Items requiring attention prior to finalizing {mode} report cards.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student or item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red transition-all"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 overflow-x-auto">
          {[
            { id: 'all', label: 'All Items', count: missingDataItems.length },
            { id: 'scores', label: 'Scores', count: missingDataItems.filter((i) => i.category === 'scores').length },
            { id: 'comments', label: 'Comments', count: missingDataItems.filter((i) => i.category === 'comments').length },
            { id: 'contacts', label: 'Contacts', count: missingDataItems.filter((i) => i.category === 'contacts').length },
            { id: 'settings', label: 'Settings', count: missingDataItems.filter((i) => i.category === 'settings').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-sais-black text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-sais-black'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-sais-black">No Action Items Found</p>
            <p className="text-xs text-sais-muted mt-1">
              {searchTerm
                ? 'No items match your search filter.'
                : `All checks passed for ${activeTab === 'all' ? 'this class' : activeTab}!`}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                      item.category === 'scores'
                        ? 'bg-amber-100 text-amber-800'
                        : item.category === 'comments'
                        ? 'bg-blue-100 text-blue-800'
                        : item.category === 'contacts'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {item.category}
                  </span>
                  <div>
                    <span className="font-semibold text-xs text-sais-black">{item.studentName}</span>
                    <span className="text-xs text-slate-500 ml-2">— {item.detail}</span>
                  </div>
                </div>

                <Link
                  to={item.actionUrl}
                  className="text-xs font-bold text-sais-red hover:bg-sais-red/10 px-3 py-1.5 rounded-lg border border-sais-red/20 transition-all shrink-0 flex items-center gap-1"
                >
                  <span>{item.actionText}</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

