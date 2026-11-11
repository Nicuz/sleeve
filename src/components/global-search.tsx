import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Clock,
  Disc3,
  Heart,
  LibraryBig,
  Loader2,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import {
  highlightTerms,
  parseSearchQuery,
  type ParsedSearchQuery,
} from '@/lib/search-query';
import {
  SEARCH_SCOPES,
  clearRecentSearches,
  loadRecentSearches,
  loadSearchScope,
  rememberSearch,
  saveSearchScope,
} from '@/lib/search-preferences';
import type {
  GlobalSearchArtist,
  GlobalSearchRelease,
  GlobalSearchScope,
  GlobalSearchWishlist,
} from '@/lib/types';
import { cn, pluralize } from '@/lib/utils';
import { useApp } from './app-context';
import { CoverArt } from './cover-art';
import { useToast } from './toast';

type SearchEntry =
  | { kind: 'release'; key: string; release: GlobalSearchRelease }
  | { kind: 'artist'; key: string; artist: GlobalSearchArtist }
  | { kind: 'wishlist'; key: string; item: GlobalSearchWishlist }
  | { kind: 'all'; key: 'all' };

type RowAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pending?: boolean;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWithMap(text: string) {
  let normalized = '';
  const map: Array<{ start: number; end: number }> = [];
  let offset = 0;
  for (const char of text) {
    const length = char.length;
    const stripped = char.normalize('NFD').replace(/\p{M}/gu, '');
    for (const unit of stripped) {
      normalized += unit;
      map.push({ start: offset, end: offset + length });
    }
    offset += length;
  }
  return { normalized, map };
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const normalizedTerms = [
    ...new Set(
      terms
        .map((term) => term.normalize('NFD').replace(/\p{M}/gu, ''))
        .filter((term) => term.length >= 1),
    ),
  ];
  if (normalizedTerms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${normalizedTerms.map(escapeRegExp).join('|')})`, 'gi');
  const { normalized, map } = normalizeWithMap(text);
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of normalized.matchAll(pattern)) {
    const index = match.index ?? 0;
    const start = map[index]?.start;
    const end = map[index + match[0].length - 1]?.end;
    if (start === undefined || end === undefined || start < cursor) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={`${start}-${end}`} className="rounded bg-accent/15 px-0.5 text-accent">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }

  if (parts.length === 0) return <>{text}</>;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function SearchRow({
  index,
  active,
  onActive,
  onSelect,
  action,
  children,
}: {
  index: number;
  active: boolean;
  onActive: () => void;
  onSelect: () => void;
  action?: RowAction;
  children: ReactNode;
}) {
  return (
    <div
      id={`global-search-option-${index}`}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={onActive}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
        active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]',
      )}
    >
      {children}
      {action && (
        <button
          type="button"
          aria-label={action.label}
          title={action.label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-cream focus-visible:bg-white/10 focus-visible:text-cream sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          {action.pending ? <Loader2 size={14} className="animate-spin" /> : action.icon}
        </button>
      )}
    </div>
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

function OperatorChips({ parsed }: { parsed: ParsedSearchQuery }) {
  const active = Object.entries(parsed.filters).filter(([, value]) => Boolean(value));
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-2.5 py-2">
      {active.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/[0.08] px-2 py-0.5 text-[10px] text-accent"
        >
          <span className="text-accent/60">{key}</span>
          {value}
        </span>
      ))}
    </div>
  );
}

export function GlobalSearch() {
  const { openAdd } = useApp();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scope, setScope] = useState<GlobalSearchScope>(loadSearchScope);
  const [recent, setRecent] = useState<string[]>(loadRecentSearches);
  const [pendingWishlistId, setPendingWishlistId] = useState<string | null>(null);

  const trimmed = value.trim();
  const parsed = useMemo(() => parseSearchQuery(debounced), [debounced]);
  const terms = useMemo(() => highlightTerms(parsed), [parsed]);
  const showRecent = resultsOpen && trimmed.length === 0 && recent.length > 0;
  const showResults = resultsOpen && debounced.trim().length >= 2;
  const panelOpen = showRecent || showResults;

  const searchQuery = useQuery({
    queryKey: ['global-search', debounced, scope],
    queryFn: ({ signal }) => api.globalSearch(debounced, { limit: 6, scope }, signal),
    enabled: debounced.trim().length >= 2 && resultsOpen,
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
    const total = scope === 'wishlist' ? data.wishlist.total : data.releases.total;
    if (total > 0 && scope !== 'artists') next.push({ kind: 'all', key: 'all' });
    return next;
  }, [searchQuery.data, scope]);

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
    if (!panelOpen) return;
    const media = window.matchMedia('(max-width: 639px)');
    if (!media.matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!resultsOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setResultsOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [resultsOpen]);

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

  function remember(query: string) {
    setRecent(rememberSearch(query));
  }

  function runSearch(query: string) {
    const clean = query.trim();
    setValue(clean);
    setDebounced(clean);
    if (clean) remember(clean);
    closeResults();
    if (!clean) {
      if (location.pathname !== '/') navigate('/');
      return;
    }
    if (location.pathname === '/') {
      skipQuerySyncRef.current = true;
      const next = new URLSearchParams(params);
      next.set('q', clean);
      setParams(next, { replace: true });
    } else {
      const next = new URLSearchParams();
      next.set('q', clean);
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

  function changeScope(next: GlobalSearchScope) {
    setScope(next);
    saveSearchScope(next);
    setActiveIndex(-1);
    setResultsOpen(true);
  }

  async function addWishlistToLibrary(item: GlobalSearchWishlist) {
    if (item.releaseGroupId) {
      closeResults();
      openAdd({
        query: `rgid:${item.releaseGroupId}`,
        display: `${item.artist} — ${item.title}`,
      });
      return;
    }
    setPendingWishlistId(item.id);
    try {
      const created = await api.createRelease({
        musicbrainzId: item.musicbrainzId,
        title: item.title,
        artist: item.artist,
        artistId: item.artistId,
        year: item.year,
        releaseDate: item.releaseDate,
        country: item.country,
        label: item.label,
        catalogNumber: item.catalogNumber,
        barcode: item.barcode,
        format: item.format,
        formatDetail: item.formatDetail,
        coverUrl: item.coverUrl,
        notes: item.notes,
      });
      await api.deleteWishlistItem(item.id);
      queryClient.invalidateQueries();
      remember(value);
      toast(`“${created.release.title}” added to your library`, 'success');
      closeResults();
    } catch (error) {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not add this release to your library',
        'error',
      );
    } finally {
      setPendingWishlistId(null);
    }
  }

  function viewAll() {
    const clean = value.trim();
    remember(clean);
    closeResults();
    if (!clean) return;
    if (scope === 'wishlist') {
      navigate(`/wishlist?q=${encodeURIComponent(clean)}`);
      return;
    }
    if (location.pathname === '/') {
      skipQuerySyncRef.current = true;
      const next = new URLSearchParams(params);
      next.set('q', clean);
      setParams(next, { replace: true });
    } else {
      const next = new URLSearchParams();
      next.set('q', clean);
      navigate({ pathname: '/', search: next.toString() });
    }
    inputRef.current?.blur();
  }

  function chooseEntry(entry: SearchEntry) {
    closeResults();
    if (entry.kind === 'release') {
      remember(value);
      navigate(`/releases/${entry.release.id}`);
      return;
    }
    if (entry.kind === 'artist') {
      remember(value);
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
      remember(value);
      navigate(`/wishlist?item=${entry.item.id}`);
      return;
    }
    viewAll();
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (showRecent) {
        setActiveIndex((index) => (recent.length ? (index + 1) % recent.length : -1));
        return;
      }
      if (!showResults) {
        if (trimmed.length >= 2 || recent.length > 0) {
          setResultsOpen(true);
          setActiveIndex(0);
        }
        return;
      }
      if (entries.length === 0) return;
      setActiveIndex((index) => (index + 1) % entries.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (showRecent) {
        setActiveIndex((index) =>
          recent.length ? (index <= 0 ? recent.length - 1 : index - 1) : -1,
        );
        return;
      }
      if (!showResults || entries.length === 0) return;
      setActiveIndex((index) => (index <= 0 ? entries.length - 1 : index - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (showResults && activeIndex >= 0 && entries[activeIndex]) {
        chooseEntry(entries[activeIndex]);
      } else if (showRecent && activeIndex >= 0 && recent[activeIndex]) {
        runSearch(recent[activeIndex]);
      } else {
        runSearch(value);
      }
      return;
    }
    if (event.key === 'Escape') {
      if (panelOpen) {
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
  const allIndex = entries.findIndex((entry) => entry.kind === 'all');
  const hasResults = entries.length > 0;
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const footerTotal =
    scope === 'wishlist' ? (data?.wishlist.total ?? 0) : (data?.releases.total ?? 0);
  const musicBrainzQuery =
    parsed.text ||
    parsed.filters.artist ||
    parsed.filters.title ||
    parsed.filters.track ||
    '';
  const activeOptionId =
    showRecent && activeIndex >= 0
      ? `global-search-recent-${activeIndex}`
      : showResults && activeIndex >= 0
        ? `global-search-option-${activeIndex}`
        : undefined;

  return (
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
          if (
            value.trim().length >= 2 ||
            (value.trim().length === 0 && recent.length > 0)
          ) {
            setResultsOpen(true);
          }
        }}
        onKeyDown={onSearchKeyDown}
        placeholder="Search collection, artists, wishlist…"
        className="input h-10 pr-16 pl-10"
        aria-label="Search your collection"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={panelOpen}
        aria-controls="global-search-results"
        aria-activedescendant={activeOptionId}
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

      {panelOpen && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="fixed inset-x-0 top-[64px] z-50 flex h-[calc(100dvh-64px)] flex-col overflow-hidden border-t border-white/10 bg-ink-900 sm:absolute sm:inset-x-0 sm:top-[calc(100%+0.5rem)] sm:h-auto sm:max-h-[min(70vh,34rem)] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl sm:shadow-black/40 sm:backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 sm:hidden">
            <p className="text-[10px] tracking-[0.16em] text-muted/60 uppercase">
              Search
            </p>
            <button
              type="button"
              onClick={closeResults}
              className="icon-btn h-8 w-8"
              aria-label="Close search"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] px-2.5 py-2">
            {SEARCH_SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={scope === option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => changeScope(option.value)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition',
                  scope === option.value
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-white/10 text-muted hover:border-white/20 hover:text-cream',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 sm:flex-none sm:max-h-[min(62vh,30rem)]">
            {showRecent ? (
              <>
                <div className="flex items-center justify-between px-1 pt-1">
                  <SectionLabel>Recent searches</SectionLabel>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentSearches();
                      setRecent([]);
                    }}
                    className="pr-2 text-[11px] text-muted transition hover:text-cream"
                  >
                    Clear
                  </button>
                </div>
                {recent.map((query, index) => (
                  <button
                    key={query}
                    id={`global-search-recent-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runSearch(query)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                      activeIndex === index ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-muted">
                      <Clock size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-cream">
                      {query}
                    </span>
                  </button>
                ))}
                <p className="px-2.5 py-2 text-[11px] text-muted/50">
                  Tip: search title or artist. Use label:, catalog:, genre:, track:, year:
                  or format: for deeper cuts. Quote multi-word values.
                </p>
              </>
            ) : searchQuery.isLoading && !data ? (
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
                  Try a title or artist. Use an operator for label, catalog, genre or
                  track.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    closeResults();
                    openAdd({
                      query: musicBrainzQuery,
                      display: musicBrainzQuery,
                    });
                  }}
                  className="btn btn-secondary mt-3 py-2 text-xs"
                >
                  <Search size={13} />
                  Search MusicBrainz
                </button>
              </div>
            ) : (
              <>
                <OperatorChips parsed={parsed} />

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
                        action={
                          release.artistId
                            ? {
                                label: `Open ${release.artist}`,
                                icon: <UserRound size={14} />,
                                onClick: () => {
                                  remember(value);
                                  navigate(`/artists/${release.artistId}`);
                                },
                              }
                            : undefined
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
                            <Highlight text={release.title} terms={terms} />
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted">
                            <Highlight text={release.artist} terms={terms} />
                            {release.year ? (
                              <>
                                {' · '}
                                <Highlight text={String(release.year)} terms={terms} />
                              </>
                            ) : null}
                            {release.track ? (
                              <>
                                {' · Track: '}
                                <Highlight text={release.track} terms={terms} />
                              </>
                            ) : release.format ? (
                              <>
                                {' · '}
                                <Highlight text={release.format} terms={terms} />
                              </>
                            ) : null}
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
                              <Highlight text={artist.name} terms={terms} />
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
                          action={{
                            label: item.releaseGroupId
                              ? 'Choose edition'
                              : 'Add to library',
                            icon: <LibraryBig size={14} />,
                            pending: pendingWishlistId === item.id,
                            onClick: () => void addWishlistToLibrary(item),
                          }}
                        >
                          <CoverArt
                            src={item.coverUrl}
                            title={item.title}
                            className="h-10 w-10 shrink-0 rounded-lg"
                            iconSize={16}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-cream">
                              <Highlight text={item.title} terms={terms} />
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted">
                              <Highlight text={item.artist} terms={terms} />
                              {item.year ? (
                                <>
                                  {' · '}
                                  <Highlight text={String(item.year)} terms={terms} />
                                </>
                              ) : null}
                            </span>
                          </span>
                          <Heart size={14} className="shrink-0 text-muted/40" />
                        </SearchRow>
                      );
                    })}
                  </section>
                )}

                {allIndex >= 0 && (
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
                        View all{' '}
                        {pluralize(
                          footerTotal,
                          scope === 'wishlist' ? 'wishlist item' : 'release',
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {scope === 'wishlist'
                          ? `Open the wishlist with “${debounced}”`
                          : `Open the library with “${debounced}”`}
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
  );
}
