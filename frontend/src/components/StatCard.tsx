import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-blue-400', loading }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
      <div className={`flex-shrink-0 p-2.5 rounded-lg bg-gray-800 ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-gray-800 animate-pulse rounded mt-0.5" />
        ) : (
          <p className="text-2xl font-semibold text-white mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}
