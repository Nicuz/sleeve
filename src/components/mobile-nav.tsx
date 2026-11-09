import { Link, useLocation } from 'react-router-dom';
import { ChartNoAxesColumnIncreasing, LibraryBig, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from './app-context';

export function MobileNav() {
  const { openAdd } = useApp();
  const { pathname } = useLocation();
  const libraryActive =
    pathname === '/' || pathname.startsWith('/releases/');
  const insightsActive = pathname.startsWith('/stats');

  const itemClass = (active: boolean) =>
    cn(
      'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition',
      active ? 'text-cream' : 'text-muted',
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-3 items-center px-4 py-1">
        <Link to="/" className={itemClass(libraryActive)}>
          <LibraryBig
            size={20}
            className={libraryActive ? 'text-accent' : undefined}
          />
          Library
        </Link>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openAdd}
            className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-accent text-ink-950 shadow-[0_10px_30px_-8px_rgba(244,184,96,0.9)] transition active:scale-95"
            aria-label="Add release"
          >
            <Plus size={22} />
          </button>
        </div>
        <Link to="/stats" className={itemClass(insightsActive)}>
          <ChartNoAxesColumnIncreasing
            size={20}
            className={insightsActive ? 'text-accent' : undefined}
          />
          Insights
        </Link>
      </div>
    </nav>
  );
}
