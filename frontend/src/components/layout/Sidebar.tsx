import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Bell,
  FileText,
  Settings,
  Users,
  ShieldAlert,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  { label: '대시보드', path: '/', icon: <LayoutDashboard size={20} /> },
  { label: '서버 관리', path: '/servers', icon: <Server size={20} /> },
  { label: '알림', path: '/alerts', icon: <Bell size={20} /> },
  { label: '알림 규칙', path: '/alert-rules', icon: <ShieldAlert size={20} /> },
  { label: '리포트', path: '/reports', icon: <FileText size={20} /> },
];

const subNav: NavItem[] = [
  { label: '설정', path: '/settings', icon: <Settings size={20} /> },
  { label: '사용자', path: '/users', icon: <Users size={20} /> },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-all duration-150 ${
          active
            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside
      className="fixed left-0 bottom-0 w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-30"
      style={{ top: '3.5rem' }}
    >
      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          메뉴
        </p>
        {mainNav.map(renderNavItem)}

        {/* Separator */}
        <div className="my-3 border-t border-gray-100 dark:border-gray-700" />

        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          관리
        </p>
        {subNav.map(renderNavItem)}
      </nav>

      {/* Version */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-400 dark:text-gray-500">ServerEye v1.0.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;
