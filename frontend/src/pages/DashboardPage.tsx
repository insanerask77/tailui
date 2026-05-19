import { Server, Wifi, Users, Activity, WifiOff, AlertCircle } from 'lucide-react';
import { useOverview, type AuditEvent } from '../api/overview';
import { StatCard } from '../components/StatCard';
import { Skeleton } from '../components/Skeleton';

function formatTs(ts: number): string {
  return new Intl.DateTimeFormat('default', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts * 1000));
}

function EventRow({ event }: { event: AuditEvent }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">
          <span className="font-medium">{event.actor}</span>
          {' · '}
          <span className="text-gray-300">{event.action}</span>
          {event.target && (
            <span className="text-gray-400"> {event.target}</span>
          )}
        </p>
      </div>
      <span className="text-xs text-gray-500 flex-shrink-0">{formatTs(event.ts)}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useOverview();

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Network health and recent activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Nodes"
          value={data?.nodesTotal ?? 0}
          icon={Server}
          iconColor="text-blue-400"
          loading={isLoading}
        />
        <StatCard
          label="Online"
          value={data?.nodesOnline ?? 0}
          icon={Wifi}
          iconColor="text-teal-400"
          loading={isLoading}
        />
        <StatCard
          label="Users"
          value={data?.usersCount ?? 0}
          icon={Users}
          iconColor="text-purple-400"
          loading={isLoading}
        />
      </div>

      {/* Network health banner */}
      {!isLoading && !isError && data && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-8 text-sm ${
          data.nodesOnline > 0
            ? 'bg-teal-950 border border-teal-800 text-teal-300'
            : 'bg-gray-900 border border-gray-700 text-gray-400'
        }`}>
          {data.nodesOnline > 0
            ? <Wifi size={15} className="flex-shrink-0" />
            : <WifiOff size={15} className="flex-shrink-0" />}
          {data.nodesOnline > 0
            ? `${data.nodesOnline} of ${data.nodesTotal} nodes online`
            : 'No nodes currently online'}
        </div>
      )}

      {/* Headscale connection error */}
      {isError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-8 text-sm bg-red-950 border border-red-800 text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>Cannot reach Headscale: {(error as Error).message}</span>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Activity size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium text-white">Recent Activity</h2>
        </div>

        <div className="px-5">
          {isLoading && (
            <div className="space-y-3 py-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          )}

          {!isLoading && data?.recentEvents.length === 0 && (
            <p className="py-6 text-sm text-gray-500 text-center">No activity yet</p>
          )}

          {!isLoading && data?.recentEvents.map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
        </div>
      </div>
    </div>
  );
}
