import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const res = await fetch('/auth/me');
    if (!res.ok) {
      throw redirect({ to: '/login' });
    }
    const data = await res.json() as { username: string };
    return { username: data.username };
  },
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([loginRoute, indexRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
