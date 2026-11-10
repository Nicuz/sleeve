import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function UpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    function show() {
      setVisible(true);
    }
    window.addEventListener('sleeve:update-ready', show);
    return () => window.removeEventListener('sleeve:update-ready', show);
  }, []);

  async function reload() {
    setReloading(true);
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.waiting?.postMessage('SKIP_WAITING');
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    );
    window.setTimeout(() => window.location.reload(), 1500);
  }

  if (!visible) return null;

  return (
    <div className="animate-scale-in fixed right-4 bottom-20 z-[80] w-[calc(100%-2rem)] max-w-sm sm:bottom-6">
      <div className="panel flex items-start gap-3 bg-ink-800/95 p-4   backdrop-blur-xl">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <RefreshCw size={16} className={reloading ? 'animate-spin' : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-cream">Update available</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Reload to get the latest version of Sleeve.
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={reloading}
            className="btn btn-primary mt-3 px-3 py-1.5 text-xs"
          >
            {reloading ? 'Reloading…' : 'Reload now'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-muted transition hover:text-cream"
          aria-label="Dismiss update"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
