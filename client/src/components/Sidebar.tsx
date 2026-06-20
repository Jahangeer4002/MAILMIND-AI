import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  PenSquare,
  Tags,
  MessageSquare,
  Newspaper,
  Settings,
  Mail,
} from 'lucide-react';
import { useUIStore } from '../store';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/compose', icon: PenSquare, label: 'AI Compose' },
  { to: '/categories', icon: Tags, label: 'Categories' },
  { to: '/assistant', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/news', icon: Newspaper, label: 'News Digest' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-64' : 'w-16'
      } flex flex-col border-r border-gray-200 bg-white transition-all duration-200`}
    >
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
        <Mail className="h-7 w-7 text-primary-600" />
        {sidebarOpen && (
          <span className="text-lg font-bold text-primary-700">MailMind AI</span>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
