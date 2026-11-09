import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  ChartNoAxesColumnIncreasing,
  Compass,
  Heart,
  LibraryBig,
  Menu,
  Plus,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from './app-context';
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
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(params.get('q') ?? '');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setValue(params.get('q') ?? '');
  }, [params]);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function updateSearch(next: string) {
    setValue(next);
    if (location.pathname !== '/') {
      const query = new URLSearchParams();
      if (next) query.set('q', next);
      navigate({ pathname: '/', search: query.toString() });
      return;
    }
    const query = new URLSearchParams(params);
    if (next) query.set('q', next);
    else query.delete('q');
    setParams(query, { replace: true });
  }

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

          <Link
            to="/"
            className="shrink-0 lg:hidden"
            aria-label="Sleeve home"
          >
            <Logo compact />
          </Link>

          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted/70"
            />
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search your collection…"
              className="input h-10 pr-16 pl-10"
              aria-label="Search your collection"
            />
            {value ? (
              <button
                type="button"
                onClick={() => updateSearch('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1.5 text-muted transition hover:bg-white/10 hover:text-cream"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted/60 sm:block">
                {/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={() => openAdd()}
            className="btn btn-primary ml-auto h-10 px-3 sm:px-4"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add release</span>
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
                    <Icon
                      size={18}
                      className={active ? 'text-accent' : 'text-muted'}
                    />
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
