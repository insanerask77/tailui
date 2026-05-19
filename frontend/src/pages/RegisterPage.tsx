import { useState, FormEvent, useEffect } from 'react';
import { useParams, useRouter } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface InviteInfo {
  valid: boolean;
  role: string;
  namespace: string | null;
}

export default function RegisterPage() {
  const { token } = useParams({ from: '/register/$token' });
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/auth/invite/${token}`)
      .then(r => r.ok ? r.json() as Promise<InviteInfo> : Promise.reject(r))
      .then(setInvite)
      .catch(() => setInviteError('This invitation link is invalid or has expired.'));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const res = await fetch(`/auth/invite/${token}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const e = await res.json() as { error: string };
        setError(e.error ?? 'Registration failed');
        return;
      }
      const meRes = await fetch('/auth/me');
      const me = await meRes.json() as { username: string; role: 'admin' | 'user'; namespace: string | null };
      setUser(me);
      router.navigate({ to: '/' });
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600/20 border border-teal-600/30 mb-4">
            <ShieldCheck className="w-7 h-7 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-400 text-sm mt-1">You've been invited to TailUI</p>
        </div>

        {inviteError ? (
          <div className="bg-red-950/40 border border-red-700/50 rounded-xl p-4 flex gap-3 text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{inviteError}</p>
          </div>
        ) : !invite ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
            {invite.namespace && (
              <div className="bg-teal-950/30 border border-teal-700/30 rounded-lg px-4 py-3 text-sm text-teal-300">
                Your VPN namespace will be <span className="font-mono font-semibold">{invite.namespace}</span>
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="your-username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create account
              </button>
            </form>

            <p className="text-center text-xs text-gray-500">
              Already have an account?{' '}
              <a href="/login" className="text-teal-400 hover:underline">Sign in</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
