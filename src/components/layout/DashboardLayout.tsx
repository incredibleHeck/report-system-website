import { Outlet, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Settings,
  Users,
  HeartPulse,
  FileText,
  Send,
  Sparkles,
  MessageSquare,
  Wrench,
  BookOpen,
  ScrollText,
  Shield,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useUndo } from '../../context/UndoContext';
import { useDatabase } from '../../context/DatabaseContext';

export default function DashboardLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { canUndo, pop } = useUndo();
  const { replaceScores, replaceSummaries, selectedAcademicYearId, systemSettings } = useDatabase();
  const location = useLocation();

  const isGradeEntryPage =
    location.pathname === '/teacher/master' ||
    location.pathname.startsWith('/teacher/subjects/');

  // Auto-collapse sidebar on grade entry screens for maximum workspace
  useEffect(() => {
    if (isGradeEntryPage) {
      setIsCollapsed(true);
    }
  }, [location.pathname, isGradeEntryPage]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleUndo = () => {
    const snap = pop();
    if (!snap) return;
    if (snap.type === 'scores') replaceScores(snap.before);
    if (snap.type === 'summaries') replaceSummaries(snap.before);
  };

  const teacherLinks = [
    { name: 'Dashboard', to: '/teacher', icon: LayoutDashboard },
    { name: 'Class Settings', to: '/teacher/settings', icon: Settings },
    { name: 'Master Sheet', to: '/teacher/master', icon: ClipboardList },
    { name: 'Contacts', to: '/teacher/contacts', icon: Users },
    { name: 'Health Check', to: '/teacher/health', icon: HeartPulse },
    { name: 'Reports / PDF', to: '/teacher/reports', icon: FileText },
    { name: 'Delivery', to: '/teacher/delivery', icon: Send },
    { name: 'Transcripts', to: '/teacher/transcripts', icon: ScrollText },
    { name: 'AI Subject Comments', to: '/teacher/ai/subject', icon: Sparkles },
    { name: 'AI General Comment', to: '/teacher/ai/general', icon: BookOpen },
    { name: 'AI Tools', to: '/teacher/ai/tools', icon: Wrench },
    { name: 'AI Chatbot', to: '/teacher/ai/chat', icon: MessageSquare },
  ];

  const headteacherLinks = [
    { name: 'Dashboard', to: '/headteacher', icon: LayoutDashboard },
    { name: 'Transcripts', to: '/headteacher/transcripts', icon: ScrollText },
  ];

  const studentLinks = [
    { name: 'Report Cards', to: '/student', icon: FileText },
    { name: 'My Transcript', to: '/student/transcript', icon: ScrollText },
  ];

  const isTeacherView = location.pathname.startsWith('/teacher');
  const isHeadteacherRole = currentUser.role === 'headteacher';

  const links =
    currentUser.role === 'teacher'
      ? teacherLinks
      : isHeadteacherRole
        ? isTeacherView
          ? teacherLinks
          : headteacherLinks
        : studentLinks;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform bg-slate-900 text-white transition-all duration-300 ease-in-out md:static md:translate-x-0 flex flex-col shadow-xl select-none',
          isCollapsed ? 'md:w-16 w-64' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between gap-2 px-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/sais-logo.png"
              alt="St. Adelaide International Schools"
              className="h-9 w-9 object-contain flex-shrink-0 bg-white rounded-full p-0.5 shadow-xs"
            />
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-extrabold tracking-wider text-red-500 uppercase truncate font-display">
                  SAIS HecTech
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                  Report System
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          <nav className="space-y-1">
            {links.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                end={item.to === '/teacher' || item.to === '/headteacher' || item.to === '/student'}
                onClick={() => setSidebarOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-lg px-2.5 py-2 text-xs font-semibold transition-all duration-150',
                    isCollapsed ? 'justify-center' : '',
                    isActive
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'h-4 w-4 flex-shrink-0 transition-colors',
                        isCollapsed ? 'mr-0' : 'mr-3',
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Info & Actions */}
        <div className="border-t border-white/10 p-3 space-y-2 bg-white/5">
          {isHeadteacherRole && (
            isTeacherView ? (
              <button
                onClick={() => {
                  navigate('/headteacher');
                  setSidebarOpen(false);
                }}
                title={isCollapsed ? 'Switch to Admin Dashboard' : undefined}
                className={cn(
                  'w-full rounded-lg py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 transition-all shadow-xs flex items-center justify-center gap-2',
                  isCollapsed ? 'px-0' : 'px-3'
                )}
              >
                <Shield className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span>Switch to Admin</span>}
              </button>
            ) : (
              <button
                onClick={() => {
                  navigate('/teacher');
                  setSidebarOpen(false);
                }}
                title={isCollapsed ? 'Switch to Teacher View' : undefined}
                className={cn(
                  'w-full rounded-lg py-2 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 transition-all shadow-xs flex items-center justify-center gap-2',
                  isCollapsed ? 'px-0' : 'px-3'
                )}
              >
                <BookOpen className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span>Teacher View</span>}
              </button>
            )
          )}
          {currentUser.role === 'teacher' && !isCollapsed && (
            <button
              disabled={!canUndo}
              onClick={handleUndo}
              className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              Undo Last AI Write
            </button>
          )}
          <div className={cn('flex items-center gap-2.5', isCollapsed ? 'justify-center' : '')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-700 text-white font-bold text-xs shadow-xs ring-2 ring-white/10 flex-shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden min-w-0">
                <p className="truncate text-xs font-semibold text-white">{currentUser.name}</p>
                <p className="truncate text-[10px] text-slate-400 capitalize">{currentUser.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Sign Out' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors',
              isCollapsed ? 'w-full justify-center px-0' : 'w-full px-2'
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Desktop Top Header with Focus Mode Toggle */}
        <header className="hidden md:flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-2xs"
              title={isCollapsed ? 'Expand Sidebar Menu' : 'Focus Mode (Collapse Menu)'}
            >
              {isCollapsed ? (
                <>
                  <PanelLeft className="h-4 w-4 text-red-700" />
                  <span>Expand Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 text-red-700" />
                  <span>Focus Mode</span>
                </>
              )}
            </button>
            {isGradeEntryPage && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                Zen Grade Entry Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-bold shadow-2xs">
              {systemSettings?.currentTermYearInfo ? `Active: ${systemSettings.currentTermYearInfo}` : `Academic Year: ${selectedAcademicYearId || '2026-2027'} | Term: Term 1`}
            </span>
            <span>{currentUser.name}</span>
            <span className="text-slate-300">•</span>
            <span className="capitalize text-red-800 font-bold">{currentUser.role}</span>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/sais-logo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-red-800 font-display">SAIS HecTech</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
