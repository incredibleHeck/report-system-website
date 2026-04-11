import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileEdit, 
  UploadCloud, 
  GraduationCap, 
  TrendingUp,
  X
} from "lucide-react";
import { cn } from "@/src/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const teacherNavigation: NavItem[] = [
  { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { name: "Manual Entry", href: "/teacher/manual-entry", icon: FileEdit },
  { name: "Upload Results", href: "/teacher/upload-results", icon: UploadCloud },
];

const studentNavigation: NavItem[] = [
  { name: "Dashboard", href: "/student", icon: GraduationCap },
  { name: "Performance Tracker", href: "/student/performance", icon: TrendingUp },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/80 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 md:hidden">
          <span className="text-lg font-semibold text-gray-900">Menu</span>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <span className="sr-only">Close sidebar</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="h-full overflow-y-auto px-4 py-6">
          <nav className="space-y-8">
            <div>
              <h3 className="px-3 text-sm font-medium text-gray-500 uppercase tracking-wider">
                Teacher Portal
              </h3>
              <div className="mt-2 space-y-1">
                {teacherNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.href === "/teacher" || item.href === "/student"}
                    onClick={() => onClose()}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                        isActive
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            "mr-3 h-5 w-5 flex-shrink-0",
                            isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <h3 className="px-3 text-sm font-medium text-gray-500 uppercase tracking-wider">
                Student Portal
              </h3>
              <div className="mt-2 space-y-1">
                {studentNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.href === "/teacher" || item.href === "/student"}
                    onClick={() => onClose()}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                        isActive
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            "mr-3 h-5 w-5 flex-shrink-0",
                            isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
