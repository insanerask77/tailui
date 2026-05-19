import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AppLayout } from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NodesPage from './pages/NodesPage';
import UsersPage from './pages/UsersPage';
import AuthKeysPage from './pages/AuthKeysPage';
import ApiKeysPage from './pages/ApiKeysPage';
import RoutesPage from './pages/RoutesPage';
import DnsPage from './pages/DnsPage';
import AclPage from './pages/AclPage';
import AdminUsersPage from './pages/AdminUsersPage';
import { useAuthStore } from './stores/authStore';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register/$token',
  component: RegisterPage,
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async () => {
    const res = await fetch('/auth/me');
    if (!res.ok) throw redirect({ to: '/login' });
    const data = await res.json() as { username: string; role: 'admin' | 'user'; namespace: string | null };
    useAuthStore.getState().setUser(data);
    return data;
  },
  component: AppLayout,
});

const indexRoute      = createRoute({ getParentRoute: () => authenticatedRoute, path: '/', component: DashboardPage });
const nodesRoute      = createRoute({ getParentRoute: () => authenticatedRoute, path: '/nodes', component: NodesPage });
const usersRoute      = createRoute({ getParentRoute: () => authenticatedRoute, path: '/users', component: UsersPage });
const authkeysRoute   = createRoute({ getParentRoute: () => authenticatedRoute, path: '/authkeys', component: AuthKeysPage });
const apikeysRoute    = createRoute({ getParentRoute: () => authenticatedRoute, path: '/apikeys', component: ApiKeysPage });
const routesRoute     = createRoute({ getParentRoute: () => authenticatedRoute, path: '/routes', component: RoutesPage });
const dnsRoute        = createRoute({ getParentRoute: () => authenticatedRoute, path: '/dns', component: DnsPage });
const aclRoute        = createRoute({ getParentRoute: () => authenticatedRoute, path: '/acl', component: AclPage });
const adminUsersRoute = createRoute({ getParentRoute: () => authenticatedRoute, path: '/admin/users', component: AdminUsersPage });

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  authenticatedRoute.addChildren([
    indexRoute, nodesRoute, usersRoute, authkeysRoute, apikeysRoute,
    routesRoute, dnsRoute, aclRoute, adminUsersRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
