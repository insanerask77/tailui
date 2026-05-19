import { useState, useEffect } from 'react';
import { Globe, Plus, X, AlertCircle, Info, RotateCcw, Check } from 'lucide-react';
import { useDns, usePatchDns, type DnsConfig } from '../api/dns';
import { toast } from '../stores/toastStore';

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
        enabled ? 'bg-teal-600' : 'bg-gray-700'
      }`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

// ── Tag input (for nameservers / domains list) ─────────────────────────────────
function TagInput({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const val = input.trim();
    if (!val || items.includes(val)) return;
    onChange([...items, val]);
    setInput('');
  }

  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                                       bg-gray-800 text-gray-200 border border-gray-700">
            {item}
            <button
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="text-gray-500 hover:text-red-400 transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-gray-500 italic">None</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Split DNS editor ──────────────────────────────────────────────────────────
function SplitDnsEditor({
  value,
  onChange,
}: {
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}) {
  const [domain, setDomain] = useState('');
  const [ns, setNs] = useState('');

  function addEntry() {
    const d = domain.trim();
    const n = ns.trim();
    if (!d || !n) return;
    const existing = value[d] ?? [];
    if (!existing.includes(n)) {
      onChange({ ...value, [d]: [...existing, n] });
    }
    setNs('');
  }

  function removeDomain(d: string) {
    const next = { ...value };
    delete next[d];
    onChange(next);
  }

  function removeNs(d: string, n: string) {
    const next = { ...value, [d]: value[d].filter((x) => x !== n) };
    if (next[d].length === 0) delete next[d];
    onChange(next);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">Split DNS</label>
      <p className="text-xs text-gray-500 mb-3">Per-domain nameserver overrides</p>

      {Object.keys(value).length > 0 && (
        <div className="space-y-2 mb-3">
          {Object.entries(value).map(([d, nsList]) => (
            <div key={d} className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <code className="text-xs text-blue-300 font-mono flex-shrink-0 mt-0.5 min-w-24">{d}</code>
              <div className="flex flex-wrap gap-1 flex-1">
                {nsList.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                                            bg-gray-700 text-gray-300">
                    {n}
                    <button onClick={() => removeNs(d, n)} className="text-gray-500 hover:text-red-400 transition">
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
              <button onClick={() => removeDomain(d)} className="text-gray-600 hover:text-red-400 transition flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="domain.corp"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
        />
        <input
          value={ns}
          onChange={(e) => setNs(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
          placeholder="10.0.0.1"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
        />
        <button
          onClick={addEntry}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DnsPage() {
  const { data, isLoading, error } = useDns();
  const patch = usePatchDns();

  const [local, setLocal] = useState<DnsConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [restartBanner, setRestartBanner] = useState(false);

  useEffect(() => {
    if (data && !dirty) setLocal(data);
  }, [data, dirty]);

  function update<K extends keyof DnsConfig>(key: K, val: DnsConfig[K]) {
    setLocal((prev) => prev ? { ...prev, [key]: val } : prev);
    setDirty(true);
  }

  async function save() {
    if (!local || !dirty) return;
    try {
      const result = await patch.mutateAsync(local);
      toast.success('DNS config saved');
      if (result.restartRequired) setRestartBanner(true);
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function discard() {
    if (data) setLocal(data);
    setDirty(false);
  }

  const unavailable = error && (error as Error).message.includes('HEADSCALE_CONFIG_PATH');

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">DNS</h1>
        <p className="text-sm text-gray-400 mt-0.5">MagicDNS and nameserver configuration</p>
      </div>

      {/* Restart required banner */}
      {restartBanner && (
        <div className="flex items-start gap-3 bg-orange-950/50 border border-orange-800/50 rounded-xl px-4 py-3 mb-5">
          <RotateCcw size={15} className="text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-300">Headscale restart required</p>
            <p className="text-xs text-orange-400/80 mt-0.5">
              DNS changes have been written to the config file. Restart Headscale for them to take effect.
            </p>
          </div>
          <button onClick={() => setRestartBanner(false)} className="text-orange-600 hover:text-orange-400 transition">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Config path info banner */}
      <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/30 rounded-xl px-4 py-3 mb-6">
        <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          DNS is configured via <code className="font-mono">headscale/config.yaml</code> (Headscale 0.23+ removed the DNS REST API).
          Changes require a Headscale restart to take effect. Set{' '}
          <code className="font-mono">HEADSCALE_CONFIG_PATH</code> env var to enable editing.
        </p>
      </div>

      {unavailable && (
        <div className="flex items-start gap-3 bg-yellow-950/40 border border-yellow-800/40 rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-300">DNS config not accessible</p>
            <p className="text-xs text-yellow-400/80 mt-1">
              Set <code className="font-mono text-yellow-300">HEADSCALE_CONFIG_PATH=/path/to/config.yaml</code> in the
              backend environment to enable DNS management.
            </p>
          </div>
        </div>
      )}

      {error && !unavailable && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {isLoading && (
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {local && (
        <div className="space-y-6">
          {/* MagicDNS */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">MagicDNS</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automatically assigns DNS names to nodes (<code>hostname.user.base-domain</code>)
                </p>
              </div>
              <Toggle enabled={local.magicDns} onChange={(v) => update('magicDns', v)} />
            </div>
          </div>

          {/* Base domain */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <label className="block text-sm font-medium text-white mb-2">
              <Globe size={14} className="inline mr-1.5 text-gray-400" />
              Base domain
            </label>
            <input
              value={local.baseDomain}
              onChange={(e) => update('baseDomain', e.target.value)}
              placeholder="tailnet.dev"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Nodes will be reachable as <code className="font-mono text-gray-400">hostname.user.{local.baseDomain || '…'}</code>
            </p>
          </div>

          {/* Global nameservers */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <TagInput
              label="Global nameservers"
              hint="Applied to all DNS queries on the tailnet"
              items={local.nameservers}
              onChange={(v) => update('nameservers', v)}
              placeholder="1.1.1.1"
            />
          </div>

          {/* Search domains */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <TagInput
              label="Search domains"
              hint="Appended when resolving short hostnames"
              items={local.searchDomains}
              onChange={(v) => update('searchDomains', v)}
              placeholder="corp.example.com"
            />
          </div>

          {/* Split DNS */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <SplitDnsEditor value={local.splitDns} onChange={(v) => update('splitDns', v)} />
          </div>

          {/* Actions */}
          {dirty && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-950/40 border border-blue-800/40 rounded-xl">
              <span className="text-xs text-blue-300 flex-1">You have unsaved changes</span>
              <button
                onClick={discard}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                Discard
              </button>
              <button
                onClick={save}
                disabled={patch.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-blue-600
                           hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-40"
              >
                <Check size={12} />
                {patch.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
