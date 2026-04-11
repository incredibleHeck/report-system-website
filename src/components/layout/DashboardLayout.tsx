import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, LogOut, User, Menu, X, TableProperties, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export default function DashboardLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = currentUser.role === 'teacher' 
    ? [
        { name: 'Dashboard', to: '/teacher', icon: LayoutDashboard },
        { name: 'Subject Grid', to: '/teacher/grid', icon: TableProperties },
        { name: 'Master Sheet', to: '/teacher/master', icon: ClipboardList }
      ]
    : [
        { name: 'Dashboard', to: `/${currentUser.role}`, icon: LayoutDashboard }
      ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/80 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
          <span className="text-lg font-bold text-indigo-600">EduManage GH</span>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3">
          <nav className="space-y-1">
            {links.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                end
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("mr-3 h-5 w-5 flex-shrink-0", isActive ? "text-indigo-600" : "text-gray-400")} />
                    {item.name}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium text-gray-900">{currentUser.name}</p>
              <p className="truncate text-xs text-gray-500 capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 md:hidden">
          <span className="text-lg font-bold text-indigo-600">EduManage GH</span>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500">
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
