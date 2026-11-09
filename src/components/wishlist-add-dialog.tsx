import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import type { SearchResult } from '@/lib/types';
import { cn, pluralize } from '@/lib/utils';
import { CoverArt } from './cover-art';
import { useToast } from './toast';

export function WishlistAddDialog({
  open,
  onClose,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  existingIds: Set<string>;
}) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebounced('');
    setAddedIds(new Set());
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 650);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const searchQuery = useQuery({
    queryKey: ['wishlist-search', debounced],
    queryFn: ({ signal }) => api.searchMusicbrainz(debounced, 20, signal),
    enabled: open && debounced.length >= 3,
    retry: false,
    staleTime: 10 * 60_000,
  });

  const results = searchQuery.data?.results ?? [];
  const resultIds = results.map((result) => result.musicbrainzId);
  const ownedQuery = useQuery({
    queryKey: ['owned-mbids', resultIds.join(',')],
    queryFn: () => api.ownedMusicbrainzIds(resultIds),
    enabled: open && resultIds.length > 0,
    staleTime: 60_000,
  });
  const ownedIds = new Set(
    (ownedQuery.data?.releases ?? []).map((release) => release.musicbrainzId),
  );

  const addItem = useMutation({
    mutationFn: (result: SearchResult) =>
      api.createWishlistItem({
        musicbrainzId: result.musicbrainzId,
        title: result.title,
        artist: result.artist,
        artistId: result.artistId,
        year: result.year,
        releaseDate: result.releaseDate,
        country: result.country,
        label: result.label,
        catalogNumber: result.catalogNumber,
        barcode: result.barcode,
        format: result.format,
        formatDetail: result.formatDetail,
        coverUrl: result.coverUrl,
        priority: 2,
        targetCurrency: settings.defaultCurrency,
      }),
    onSuccess: ({ item }) => {
      setAddedIds((current) => new Set(current).add(item.musicbrainzId ?? ''));
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast(`“${item.title}” added to your wishlist`, 'success');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not add this release to your wishlist',
        'error',
      );
    },
  });

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/60 sm:max-h-[85vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Add to wishlist"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">
              Add to wishlist
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Search MusicBrainz. Set the target price afterwards.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-white/[0.06] p-4">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted/70"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Artist, album or barcode…"
              className="input py-2.5 pr-3 pl-9 text-[13px]"
              aria-label="Search MusicBrainz for wishlist"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {debounced.length < 3 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-muted">
                <Search size={18} />
              </span>
              <p className="mt-4 text-sm font-medium text-cream">
                Find something to hunt
              </p>
              <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-muted">
                Search an album, artist or barcode. Add it now, set priority and
                target price later.
              </p>
            </div>
          ) : searchQuery.isLoading ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-2">
                  <div className="skeleton h-12 w-12 rounded-lg" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-3/4" />
                    <div className="skeleton mt-2 h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery.isError ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-cream">Search failed</p>
              <p className="mt-1 text-xs text-muted">
                {searchQuery.error instanceof Error
                  ? searchQuery.error.message
                  : 'MusicBrainz did not respond.'}
              </p>
              <button
                type="button"
                onClick={() => searchQuery.refetch()}
                className="btn btn-secondary mt-4"
              >
                Try again
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-cream">
                No releases found
              </p>
              <p className="mt-1 text-xs text-muted">
                Try a shorter search or a different edition.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {results.map((result) => {
                const owned = ownedIds.has(result.musicbrainzId);
                const wishlisted =
                  existingIds.has(result.musicbrainzId) ||
                  addedIds.has(result.musicbrainzId);
                const pending =
                  addItem.isPending && addItem.variables?.musicbrainzId === result.musicbrainzId;
                return (
                  <div
                    key={result.musicbrainzId}
                    className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.05]"
                  >
                    <CoverArt
                      src={result.coverUrl}
                      title={result.title}
                      className="h-12 w-12 shrink-0 rounded-lg border border-white/10"
                      iconSize={18}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-cream">
                        {result.title}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {result.artist}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted/60">
                        {[
                          result.year ?? undefined,
                          result.format,
                          result.trackCount
                            ? pluralize(result.trackCount, 'track')
                            : undefined,
                          result.country ?? undefined,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {owned ? (
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-muted">
                        In library
                      </span>
                    ) : wishlisted ? (
                      <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] font-medium text-accent">
                        Wishlisted
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addItem.mutate(result)}
                        disabled={pending}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[10px] font-semibold text-accent transition hover:bg-accent/20',
                          pending && 'opacity-60',
                        )}
                      >
                        {pending ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Plus size={12} />
                        )}
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="px-2 py-3 text-center text-[10px] text-muted/50">
                {results.length} editions · data from MusicBrainz
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
