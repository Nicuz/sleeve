import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { useApp } from './app-context';
import { Logo } from './logo';

export function Header() {
  const { openAdd } = useApp();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(params.get('q') ?? '');

  useEffect(() => {
    setValue(params.get('q') ?? '');
  }, [params]);

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
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-10">
        <div className="lg:hidden">
          <Logo compact />
        </div>

        <div className="relative flex-1 lg:max-w-xl">
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
          onClick={openAdd}
          className="btn btn-primary ml-auto h-10 px-3 sm:px-4"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add release</span>
        </button>
      </div>
    </header>
  );
}
