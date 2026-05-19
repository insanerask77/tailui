import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard, Server, Users, Key, KeyRound,
  Network, Globe, ShieldCheck, LogOut, UserCog,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRouter } from '@tanstack/react-router';
import { ToastContainer } from './ToastContainer';
import { useNodeSSE } from '../hooks/useNodeSSE';

const NAV_ITEMS = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/nodes',    label: 'Nodes',     icon: Server },
  { to: '/users',    label: 'Users',     icon: Users },
  { to: '/authkeys', label: 'Auth Keys', icon: Key },
  { to: '/apikeys',  label: 'API Keys',  icon: KeyRound },
  { to: '/routes',   label: 'Routes',    icon: Network },
  { to: '/dns',      label: 'DNS',       icon: Globe },
  { to: '/acl',      label: 'ACL',       icon: ShieldCheck },
] as const;

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'Accounts', icon: UserCog },
] as const;

export function AppLayout() {
  const username  = useAuthStore((s) => s.username);
  const role      = useAuthStore((s) => s.role);
  const logout    = useAuthStore((s) => s.logout);
  const router    = useRouter();
  const pathname  = useRouterState({ select: (s) => s.location.pathname });
  useNodeSSE();

  async function handleLogout() {
    await logout();
    router.navigate({ to: '/login' });
  }

  const isActive = (to: string) => to === '/' ? pathname === '/' : pathname.startsWith(to);

  const navLink = (to: string, label: string, Icon: React.ElementType) => {
    const active = isActive(to);
    return (
      <Link key={to} to={to}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          active ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
        }`}>
        <Icon size={16} />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Network size={15} className="text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">TailUI</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => navLink(to, label, Icon))}

          {role === 'admin' && (
            <>
              <div className="pt-4 pb-1 px-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Admin</span>
              </div>
              {ADMIN_ITEMS.map(({ to, label, icon: Icon }) => navLink(to, label, Icon))}
            </>
          )}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold">
              {username?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 truncate">{username}</p>
              {role && <p className="text-xs text-gray-600 capitalize">{role}</p>}
            </div>
            <button onClick={() => void handleLogout()} className="text-gray-500 hover:text-gray-200 transition-colors" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
