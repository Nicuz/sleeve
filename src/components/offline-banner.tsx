import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );

  useEffect(() => {
    const online = () => setOffline(false);
    const gone = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', gone);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', gone);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[45] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-ink-900/95 px-3.5 py-2 text-[11px] font-medium text-cream shadow-xl shadow-black/40 backdrop-blur-xl lg:bottom-6">
      <WifiOff size={13} className="text-accent" />
      Offline · showing cached data
    </div>
  );
}
