import { useState, useEffect } from 'react';
import { X, Copy, Check, Monitor, Apple, Terminal, ChevronRight, Loader2 } from 'lucide-react';
import { useUsers } from '../api/users';
import { useCreateAuthKey } from '../api/authkeys';
import { useQuery } from '@tanstack/react-query';

interface Props {
  onClose: () => void;
}

type Platform = 'linux' | 'macos' | 'windows';

interface HeadscaleConfig {
  headscaleUrl: string;
}

async function fetchConfig(): Promise<HeadscaleConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json() as Promise<HeadscaleConfig>;
}

function useHeadscaleConfig() {
  return useQuery({ queryKey: ['config'], queryFn: fetchConfig, staleTime: Infinity });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
      {copied ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-950 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed border border-gray-800">
        {code}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function PlatformTab({ id, label, icon: Icon, active, onClick }: {
  id: Platform; label: string; icon: React.ElementType;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? 'border-teal-400 text-teal-400 bg-gray-800'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function linuxCommands(loginServer: string, authKey: string) {
  return `# 1. Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Join the VPN
sudo tailscale up --login-server ${loginServer} --authkey ${authKey}`;
}

function macosCommands(loginServer: string, authKey: string) {
  return `# Option A — Homebrew
brew install tailscale
sudo tailscaled &
sudo tailscale up --login-server ${loginServer} --authkey ${authKey}

# Option B — App Store: install "Tailscale", then run:
tailscale up --login-server ${loginServer} --authkey ${authKey}`;
}

function windowsCommands(loginServer: string, authKey: string) {
  return `# 1. Download and install Tailscale from:
#    https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe

# 2. Open PowerShell as Administrator and run:
tailscale up --login-server ${loginServer} --authkey ${authKey}`;
}

function dockerCommand(loginServer: string, authKey: string) {
  return `docker run -d \\
  --name tailscale-node \\
  --network host \\
  --cap-add=NET_ADMIN \\
  --cap-add=SYS_MODULE \\
  --device=/dev/net/tun \\
  tailscale/tailscale:latest \\
  sh -c "tailscaled --tun=userspace-networking & sleep 2 && tailscale up --login-server ${loginServer} --authkey ${authKey}"`;
}

export function AddDeviceModal({ onClose }: Props) {
  const { data: users = [] } = useUsers();
  const { data: config } = useHeadscaleConfig();
  const createKey = useCreateAuthKey();

  const [step, setStep] = useState<'configure' | 'commands'>('configure');
  const [selectedUser, setSelectedUser] = useState('');
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [platform, setPlatform] = useState<Platform>('linux');
  const [generatedKey, setGeneratedKey] = useState('');

  useEffect(() => {
    if (users.length > 0 && !selectedUser) setSelectedUser(users[0].name);
  }, [users, selectedUser]);

  const loginServer = config?.headscaleUrl ?? 'http://localhost:8080';

  const handleGenerate = async () => {
    if (!selectedUser) return;
    const expiration = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const result = await createKey.mutateAsync({ user: selectedUser, reusable, ephemeral, expiration, aclTags: [] });
    const key = result.preAuthKey?.key ?? (result as unknown as { key: string }).key ?? '';
    setGeneratedKey(key);
    setStep('commands');
  };

  const commandsByPlatform: Record<Platform, string> = {
    linux: linuxCommands(loginServer, generatedKey),
    macos: macosCommands(loginServer, generatedKey),
    windows: windowsCommands(loginServer, generatedKey),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Add device</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {step === 'configure' ? 'Configure a pre-auth key for your device' : 'Run these commands on your device'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {step === 'configure' ? (
            <>
              {/* User selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">User / namespace</label>
                <select
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {users.length === 0 && <option value="">No users — create one first</option>}
                  {users.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                </select>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Key options</label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={reusable}
                    onChange={e => setReusable(e.target.checked)}
                    className="mt-0.5 accent-teal-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-white">Reusable</div>
                    <div className="text-xs text-gray-400 mt-0.5">Can be used to register multiple devices</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={ephemeral}
                    onChange={e => setEphemeral(e.target.checked)}
                    className="mt-0.5 accent-teal-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-white">Ephemeral</div>
                    <div className="text-xs text-gray-400 mt-0.5">Node is removed when it disconnects</div>
                  </div>
                </label>
              </div>

              {/* Info */}
              <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-3 text-xs text-blue-300">
                <strong>Login server:</strong> <span className="font-mono">{loginServer}</span>
                <p className="mt-1 text-blue-400/80">Make sure this URL is reachable from the device you want to add.</p>
              </div>
            </>
          ) : (
            <>
              {/* Success banner */}
              <div className="bg-teal-950/40 border border-teal-700/50 rounded-lg p-3 flex items-start gap-3">
                <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="text-teal-300 font-medium">Auth key generated for </span>
                  <span className="font-mono text-teal-200">{selectedUser}</span>
                  <span className="text-teal-300">. It expires in 90 days.</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded truncate max-w-xs">{generatedKey.slice(0, 24)}…</span>
                    <CopyButton text={generatedKey} />
                  </div>
                </div>
              </div>

              {/* Platform tabs */}
              <div>
                <div className="flex gap-1 border-b border-gray-700">
                  <PlatformTab id="linux"   label="Linux"   icon={Terminal} active={platform === 'linux'}   onClick={() => setPlatform('linux')} />
                  <PlatformTab id="macos"   label="macOS"   icon={Apple}    active={platform === 'macos'}   onClick={() => setPlatform('macos')} />
                  <PlatformTab id="windows" label="Windows" icon={Monitor}  active={platform === 'windows'} onClick={() => setPlatform('windows')} />
                </div>
                <div className="pt-4">
                  <CodeBlock code={commandsByPlatform[platform]} />
                </div>
              </div>

              {/* Docker tab */}
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Docker (any platform)</p>
                <CodeBlock code={dockerCommand(loginServer, generatedKey)} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          {step === 'configure' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void handleGenerate()}
                disabled={!selectedUser || createKey.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {createKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Generate key & show commands
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep('configure'); setGeneratedKey(''); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                ← Generate another
              </button>
              <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors">
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
