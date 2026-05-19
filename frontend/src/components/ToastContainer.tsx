import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '../stores/toastStore';

const ICONS = {
  success: <CheckCircle size={16} className="text-teal-400 flex-shrink-0" />,
  error:   <XCircle    size={16} className="text-red-400 flex-shrink-0" />,
  info:    <Info       size={16} className="text-blue-400 flex-shrink-0" />,
};

function Toast({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  return (
    <div className="flex items-start gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                    shadow-2xl min-w-72 max-w-sm animate-in slide-in-from-right-4 duration-200">
      {ICONS[item.type]}
      <p className="flex-1 text-sm text-white">{item.message}</p>
      <button onClick={() => remove(item.id)} className="text-gray-500 hover:text-gray-300 transition-colors mt-0.5">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => <Toast key={t.id} item={t} />)}
    </div>
  );
}
