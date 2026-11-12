import { Link, useLocation } from 'react-router-dom';
import { Plus, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from './app-context';
import { GlobalSearch } from './global-search';
import { Logo } from './logo';

export function Header() {
  const { openAdd } = useApp();
  const location = useLocation();
  const settingsActive = location.pathname.startsWith('/settings');

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 lg:px-10">
        <Link to="/" className="shrink-0 lg:hidden" aria-label="Sleeve home">
          <Logo compact />
        </Link>

        <GlobalSearch />

        <button
          type="button"
          onClick={() => openAdd()}
          aria-label="Add release"
          className="btn btn-primary group ml-auto hidden h-10 w-10 shrink-0 gap-0 overflow-hidden px-0 transition-[width] duration-300 hover:w-36 hover:bg-accent focus-visible:w-36 lg:inline-flex"
        >
          <Plus
            strokeWidth={2.5}
            className="h-[22px] w-[22px] shrink-0 transition-[width,height] duration-300 group-hover:h-4 group-hover:w-4 group-focus-visible:h-4 group-focus-visible:w-4"
          />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-28 group-focus-visible:opacity-100">
            Add release
          </span>
        </button>

        <Link
          to="/settings"
          aria-label="Settings"
          aria-current={settingsActive ? 'page' : undefined}
          className={cn(
            'icon-btn h-10 w-10 shrink-0 lg:hidden',
            settingsActive && 'text-accent',
          )}
        >
          <Settings2 size={18} />
        </Link>
      </div>
    </header>
  );
}
