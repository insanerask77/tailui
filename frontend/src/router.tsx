import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AppLayout } from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useAuthStore } from './stores/authStore';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

// Layout route: checks auth once for all child routes
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async () => {
    const res = await fetch('/auth/me');
    if (!res.ok) throw redirect({ to: '/login' });
    const data = await res.json() as { username: string };
    // sync into Zustand store
    useAuthStore.getState().setUser(data.username);
    return { username: data.username };
  },
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: DashboardPage,
});

// Placeholder routes for future phases — redirect to root for now
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white mb-2">{name}</h1>
      <p className="text-gray-400 text-sm">Coming in a future phase.</p>
    </div>
  );
}

const nodesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/nodes',
  component: () => <ComingSoon name="Nodes" />,
});
const usersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users',
  component: () => <ComingSoon name="Users" />,
});
const authkeysRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/authkeys',
  component: () => <ComingSoon name="Auth Keys" />,
});
const apikeysRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/apikeys',
  component: () => <ComingSoon name="API Keys" />,
});
const routesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/routes',
  component: () => <ComingSoon name="Routes" />,
});
const dnsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dns',
  component: () => <ComingSoon name="DNS" />,
});
const aclRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/acl',
  component: () => <ComingSoon name="ACL" />,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    nodesRoute,
    usersRoute,
    authkeysRoute,
    apikeysRoute,
    routesRoute,
    dnsRoute,
    aclRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
