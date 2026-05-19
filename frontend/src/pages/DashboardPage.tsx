import { useAuthStore } from '../stores/authStore';
import { useRouter } from '@tanstack/react-router';

export default function DashboardPage() {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.navigate({ to: '/login' });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">TailUI Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Signed in as <span className="text-white">{username}</span></span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="text-gray-500">Phase 3 — Dashboard content coming soon.</p>
    </div>
  );
}
