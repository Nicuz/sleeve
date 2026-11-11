import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ChartNoAxesColumnIncreasing,
  Compass,
  Disc3,
  Heart,
  LibraryBig,
  Loader2,
  Menu,
  Plus,
  Search,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  GlobalSearchArtist,
  GlobalSearchRelease,
  GlobalSearchWishlist,
} from '@/lib/types';
import { cn, pluralize } from '@/lib/utils';
import { useApp } from './app-context';
import { CoverArt } from './cover-art';
import { Logo } from './logo';

const PAGE_LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Library', icon: LibraryBig },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/stats', label: 'Insights', icon: ChartNoAxesColumnIncreasing },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

type SearchEntry =
  | { kind: 'release'; key: string; release: GlobalSearchRelease }
  | { kind: 'artist'; key: string; artist: GlobalSearchArtist }
  | { kind: 'wishlist'; key: string; item: GlobalSearchWishlist }
  | { kind: 'all'; key: 'all' };

function isActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/' || pathname.startsWith('/releases/');
  return pathname.startsWith(to);
}

function SearchRow({
  index,
  active,
  onActive,
  onSelect,
  children,
}: {
  index: number;
  active: boolean;
  onActive: () => void;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={`global-search-option-${index}`}
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onActive}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
        active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]',
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pt-2.5 pb-1 text-[10px] tracking-[0.16em] text-muted/60 uppercase">
      {children}
    </p>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-1 p-1">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2.5 py-2">
          <div className="skeleton h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton mt-1.5 h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Header() {
  const { openAdd } = useApp();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipQuerySyncRef = useRef(false);
  const lastUrlQueryRef = useRef(params.get('q') ?? '');
  const lastPathRef = useRef(location.pathname);
  const [value, setValue] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(value.trim());
  const [menuOpen, setMenuOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = value.trim();
  const showResults = resultsOpen && trimmed.length >= 2 && debounced.length >= 2;

  const searchQuery = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: ({ signal }) => api.globalSearch(debounced, 6, signal),
    enabled: debounced.length >= 2 && resultsOpen,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const entries = useMemo<SearchEntry[]>(() => {
    const data = searchQuery.data;
    if (!data) return [];
    const next: SearchEntry[] = [];
    for (const release of data.releases.items) {
      next.push({ kind: 'release', key: `release:${release.id}`, release });
    }
    for (const artist of data.artists.items) {
      next.push({
        kind: 'artist',
        key: `artist:${artist.artistId ?? artist.name}`,
        artist,
      });
    }
    for (const item of data.wishlist.items) {
      next.push({ kind: 'wishlist', key: `wishlist:${item.id}`, item });
    }
    if (data.releases.total > 0) next.push({ kind: 'all', key: 'all' });
    return next;
  }, [searchQuery.data]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const next = params.get('q') ?? '';
    const pathChanged = lastPathRef.current !== location.pathname;
    const queryChanged = next !== lastUrlQueryRef.current;
    lastUrlQueryRef.current = next;

    if (pathChanged) {
      lastPathRef.current = location.pathname;
      skipQuerySyncRef.current = false;
      setResultsOpen(false);
      setActiveIndex(-1);
      setValue(next);
      return;
    }

    if (!queryChanged) {
      skipQuerySyncRef.current = false;
      return;
    }
    if (skipQuerySyncRef.current) {
      skipQuerySyncRef.current = false;
      return;
    }
    setValue(next);
  }, [params, location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') return;
    const current = params.get('q') ?? '';
    if (current === debounced) return;
    skipQuerySyncRef.current = true;
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced);
    else next.delete('q');
    setParams(next, { replace: true });
  }, [debounced, location.pathname, params, setParams]);

  useEffect(() => {
    setActiveIndex((index) => (index >= entries.length ? -1 : index));
  }, [entries.length]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!resultsOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setResultsOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [resultsOpen]);

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

  function closeResults() {
    setResultsOpen(false);
    setActiveIndex(-1);
  }

  function submitSearch() {
    const query = value.trim();
    closeResults();
    if (!query) {
      if (location.pathname !== '/') navigate('/');
      return;
    }
    if (location.pathname === '/') {
      skipQuerySyncRef.current = true;
      const next = new URLSearchParams(params);
      next.set('q', query);
      setParams(next, { replace: true });
    } else {
      const next = new URLSearchParams();
      next.set('q', query);
      navigate({ pathname: '/', search: next.toString() });
    }
    inputRef.current?.blur();
  }

  function clearSearch() {
    setValue('');
    setDebounced('');
    closeResults();
    if (location.pathname === '/') {
      const next = new URLSearchParams(params);
      if (next.has('q')) {
        skipQuerySyncRef.current = true;
        next.delete('q');
        setParams(next, { replace: true });
      }
    }
    inputRef.current?.focus();
  }

  function chooseEntry(entry: SearchEntry) {
    closeResults();
    if (entry.kind === 'release') {
      navigate(`/releases/${entry.release.id}`);
      return;
    }
    if (entry.kind === 'artist') {
      if (entry.artist.artistId) {
        navigate(`/artists/${entry.artist.artistId}`);
      } else {
        const next = new URLSearchParams();
        next.set('q', entry.artist.name);
        navigate({ pathname: '/', search: next.toString() });
      }
      return;
    }
    if (entry.kind === 'wishlist') {
      navigate(`/wishlist?item=${entry.item.id}`);
      return;
    }
    submitSearch();
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!showResults) {
        if (trimmed.length >= 2) setResultsOpen(true);
        return;
      }
      if (entries.length === 0) return;
      setActiveIndex((index) => (index + 1) % entries.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!showResults || entries.length === 0) return;
      setActiveIndex((index) => (index <= 0 ? entries.length - 1 : index - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (showResults && activeIndex >= 0 && entries[activeIndex]) {
        chooseEntry(entries[activeIndex]);
      } else {
        submitSearch();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (showResults) {
        event.preventDefault();
        closeResults();
      } else if (value) {
        event.preventDefault();
        clearSearch();
      }
    }
  }

  const data = searchQuery.data;
  const releaseItems = data?.releases.items ?? [];
  const artistItems = data?.artists.items ?? [];
  const wishlistItems = data?.wishlist.items ?? [];
  const artistOffset = releaseItems.length;
  const wishlistOffset = artistOffset + artistItems.length;
  const allIndex = wishlistOffset + wishlistItems.length;
  const hasResults = entries.length > 0;
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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

          <div ref={wrapperRef} className="relative min-w-0 flex-1 lg:max-w-xl">
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted/70"
            />
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setResultsOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                if (value.trim().length >= 2) setResultsOpen(true);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search your collection…"
              className="input h-10 pr-16 pl-10"
              aria-label="Search your collection"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showResults}
              aria-controls="global-search-results"
              aria-activedescendant={
                showResults && activeIndex >= 0
                  ? `global-search-option-${activeIndex}`
                  : undefined
              }
            />
            {searchQuery.isFetching && trimmed.length >= 2 && (
              <Loader2
                size={14}
                className="pointer-events-none absolute top-1/2 right-9 -translate-y-1/2 animate-spin text-muted/70"
              />
            )}
            {value ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1.5 text-muted transition hover:bg-white/10 hover:text-cream"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted/60 sm:block">
                {isApple ? '⌘K' : 'Ctrl K'}
              </kbd>
            )}

            {showResults && (
              <div
                id="global-search-results"
                role="listbox"
                aria-label="Search results"
                className="fixed inset-x-3 top-[64px] z-50 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl sm:absolute sm:inset-x-0 sm:top-[calc(100%+0.5rem)]"
              >
                <div className="max-h-[min(70vh,34rem)] overflow-y-auto p-1.5">
                  {searchQuery.isLoading && !data ? (
                    <SearchSkeleton />
                  ) : searchQuery.isError ? (
                    <div className="px-4 py-7 text-center">
                      <p className="text-sm font-medium text-cream">Search unavailable</p>
                      <p className="mt-1 text-xs text-muted">
                        {searchQuery.error instanceof Error
                          ? searchQuery.error.message
                          : 'Check the API and try again.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => searchQuery.refetch()}
                        className="btn btn-secondary mt-3 py-2 text-xs"
                      >
                        Try again
                      </button>
                    </div>
                  ) : !hasResults ? (
                    <div className="px-4 py-7 text-center">
                      <p className="text-sm font-medium text-cream">
                        No matches for “{debounced}”
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Try a title, artist, label or track name.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          closeResults();
                          openAdd({ query: debounced, display: debounced });
                        }}
                        className="btn btn-secondary mt-3 py-2 text-xs"
                      >
                        <Search size={13} />
                        Search MusicBrainz
                      </button>
                    </div>
                  ) : (
                    <>
                      {releaseItems.length > 0 && (
                        <section>
                          <SectionLabel>In your library</SectionLabel>
                          {releaseItems.map((release, index) => (
                            <SearchRow
                              key={release.id}
                              index={index}
                              active={activeIndex === index}
                              onActive={() => setActiveIndex(index)}
                              onSelect={() =>
                                chooseEntry({
                                  kind: 'release',
                                  key: `release:${release.id}`,
                                  release,
                                })
                              }
                            >
                              <CoverArt
                                src={release.coverUrl}
                                title={release.title}
                                className="h-10 w-10 shrink-0 rounded-lg"
                                iconSize={16}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-cream">
                                  {release.title}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-muted">
                                  {release.artist}
                                  {release.year ? ` · ${release.year}` : ''}
                                  {release.track
                                    ? ` · Track: ${release.track}`
                                    : release.format
                                      ? ` · ${release.format}`
                                      : ''}
                                </span>
                              </span>
                              <Disc3 size={14} className="shrink-0 text-muted/40" />
                            </SearchRow>
                          ))}
                        </section>
                      )}

                      {artistItems.length > 0 && (
                        <section>
                          <SectionLabel>Artists</SectionLabel>
                          {artistItems.map((artist, index) => {
                            const itemIndex = artistOffset + index;
                            return (
                              <SearchRow
                                key={`${artist.artistId ?? artist.name}-${index}`}
                                index={itemIndex}
                                active={activeIndex === itemIndex}
                                onActive={() => setActiveIndex(itemIndex)}
                                onSelect={() =>
                                  chooseEntry({
                                    kind: 'artist',
                                    key: `artist:${artist.artistId ?? artist.name}`,
                                    artist,
                                  })
                                }
                              >
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-muted">
                                  <UserRound size={16} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-cream">
                                    {artist.name}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                                    {pluralize(artist.count, 'release')} in your library
                                  </span>
                                </span>
                              </SearchRow>
                            );
                          })}
                        </section>
                      )}

                      {wishlistItems.length > 0 && (
                        <section>
                          <SectionLabel>Wishlist</SectionLabel>
                          {wishlistItems.map((item, index) => {
                            const itemIndex = wishlistOffset + index;
                            return (
                              <SearchRow
                                key={item.id}
                                index={itemIndex}
                                active={activeIndex === itemIndex}
                                onActive={() => setActiveIndex(itemIndex)}
                                onSelect={() =>
                                  chooseEntry({
                                    kind: 'wishlist',
                                    key: `wishlist:${item.id}`,
                                    item,
                                  })
                                }
                              >
                                <CoverArt
                                  src={item.coverUrl}
                                  title={item.title}
                                  className="h-10 w-10 shrink-0 rounded-lg"
                                  iconSize={16}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-cream">
                                    {item.title}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                                    {item.artist}
                                    {item.year ? ` · ${item.year}` : ''}
                                  </span>
                                </span>
                                <Heart size={14} className="shrink-0 text-muted/40" />
                              </SearchRow>
                            );
                          })}
                        </section>
                      )}

                      {data && data.releases.total > 0 && (
                        <SearchRow
                          index={allIndex}
                          active={activeIndex === allIndex}
                          onActive={() => setActiveIndex(allIndex)}
                          onSelect={() => chooseEntry({ kind: 'all', key: 'all' })}
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                            <ArrowUpRight size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-cream">
                              View all {pluralize(data.releases.total, 'release')}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted">
                              Open the library with “{debounced}”
                            </span>
                          </span>
                        </SearchRow>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

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
