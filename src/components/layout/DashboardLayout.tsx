import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useUndo } from '../../context/UndoContext';
import { useDatabase } from '../../context/DatabaseContext';

export default function DashboardLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { canUndo, pop } = useUndo();
  const { replaceScores, replaceSummaries } = useDatabase();

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

  const links =
    currentUser.role === 'teacher'
      ? teacherLinks
      : currentUser.role === 'headteacher'
        ? headteacherLinks
        : studentLinks;

  return (
    <div className="flex h-screen overflow-hidden bg-sais-cream">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-sais-black/70 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-sais-black text-white transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/sais-logo.png"
              alt="St. Adelaide International Schools"
              className="h-12 w-12 object-contain flex-shrink-0 bg-white rounded-full p-0.5"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide text-sais-red truncate font-display">
                SAIS HecTech
              </p>
              <p className="text-[10px] text-sais-brown-light uppercase tracking-wider">
                Report System
              </p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/60">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          <nav className="space-y-0.5">
            {links.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                end={item.to === '/teacher' || item.to === '/headteacher' || item.to === '/student'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-md px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-sais-red/20 text-white border-l-2 border-sais-red'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'mr-3 h-4 w-4 flex-shrink-0',
                        isActive ? 'text-sais-brown-light' : 'text-white/40'
                      )}
                    />
                    {item.name}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4 space-y-2">
          {currentUser.role === 'teacher' && (
            <button
              disabled={!canUndo}
              onClick={handleUndo}
              className="w-full rounded-md px-3 py-2 text-xs font-medium text-sais-brown-light hover:bg-sais-brown/15 disabled:opacity-40"
            >
              Undo Last AI Write
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sais-red text-white font-bold text-sm">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium">{currentUser.name}</p>
              <p className="truncate text-xs text-white/50 capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sais-red hover:bg-sais-red/10"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-sais-brown/20 bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/sais-logo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-sais-red font-display">SAIS HecTech</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-sais-muted">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
