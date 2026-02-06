import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Bell,
  FileText,
  Settings,
  Users,
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
        className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors duration-150 ${
          active
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNav.map(renderNavItem)}

        {/* Separator */}
        <div className="my-2 border-t border-gray-100" />

        {subNav.map(renderNavItem)}
      </nav>

      {/* Version */}
      <div className="px-4 py-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">v1.0.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;
