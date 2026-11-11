import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartNoAxesColumnIncreasing,
  Compass,
  Heart,
  LibraryBig,
  Menu,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from './app-context';
import { GlobalSearch } from './global-search';
import { Logo } from './logo';

const PAGE_LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Library', icon: LibraryBig },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/stats', label: 'Insights', icon: ChartNoAxesColumnIncreasing },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

function isActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/' || pathname.startsWith('/releases/');
  return pathname.startsWith(to);
}

export function Header() {
  const { openAdd } = useApp();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 lg:px-10">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="icon-btn h-10 w-10 lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu size={18} />
          </button>

          <Link to="/" className="shrink-0 lg:hidden" aria-label="Sleeve home">
            <Logo compact />
          </Link>

          <GlobalSearch />

          <button
            type="button"
            onClick={() => openAdd()}
            aria-label="Add release"
            className="btn btn-primary group ml-auto h-10 w-10 shrink-0 gap-0 overflow-hidden px-0 transition-[width] duration-300 hover:w-36 hover:bg-accent focus-visible:w-36"
          >
            <Plus
              strokeWidth={2.5}
              className="h-[22px] w-[22px] shrink-0 transition-[width,height] duration-300 group-hover:h-4 group-hover:w-4 group-focus-visible:h-4 group-focus-visible:w-4"
            />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-28 group-focus-visible:opacity-100">
              Add release
            </span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-ink-900 p-5">
            <div className="flex items-center justify-between">
              <Link to="/" aria-label="Sleeve home">
                <Logo />
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="icon-btn h-9 w-9"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="mt-8 space-y-1">
              {PAGE_LINKS.map(({ to, label, icon: Icon }) => {
                const active = isActive(location.pathname, to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                      active
                        ? 'bg-white/[0.07] text-cream'
                        : 'text-muted hover:bg-white/[0.04] hover:text-cream',
                    )}
                  >
                    <Icon size={18} className={active ? 'text-accent' : 'text-muted'} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openAdd();
              }}
              className="btn btn-primary mt-auto w-full py-2.5 text-sm"
            >
              <Plus size={16} />
              Add release
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
