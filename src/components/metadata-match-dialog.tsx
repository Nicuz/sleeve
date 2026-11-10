import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, Loader2, Search, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn, pluralize } from '@/lib/utils';
import { CoverArt } from './cover-art';
import { useToast } from './toast';

export function MetadataMatchDialog({
  open,
  onClose,
  releaseId,
  title,
  artist,
}: {
  open: boolean;
  onClose: () => void;
  releaseId: string;
  title: string;
  artist: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = `${artist} ${title}`.trim();
    setQuery(initial);
    setDebounced(initial);
    setSelectedId(null);
  }, [open, artist, title]);

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
    queryKey: ['mb-manual-match', debounced],
    queryFn: ({ signal }) => api.searchMusicbrainz(debounced, 20, signal),
    enabled: open && debounced.length >= 3,
    retry: false,
    staleTime: 10 * 60_000,
  });

  const results = searchQuery.data?.results ?? [];
  const selected = results.find((result) => result.musicbrainzId === selectedId);

  const applyMatch = useMutation({
    mutationFn: () => api.applyReleaseMatch(releaseId, selectedId as string),
    onSuccess: (result) => {
      if (result.status === 'matched' && result.release) {
        queryClient.setQueryData(['release', releaseId], {
          release: result.release,
        });
        queryClient.invalidateQueries({ queryKey: ['releases'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['meta'] });
        queryClient.invalidateQueries({ queryKey: ['discover'] });
        toast('Metadata applied from MusicBrainz', 'success');
        onClose();
        return;
      }
      if (result.status === 'duplicate') {
        toast('That release is already in your library.', 'error');
        return;
      }
      toast('Could not apply this match.', 'error');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not apply metadata',
        'error',
      );
    },
  });

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !applyMatch.isPending) {
          onClose();
        }
      }}
    >
      <div
        className="animate-scale-in flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900   sm:max-h-[88vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Match metadata manually"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">
              Match manually
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Search MusicBrainz and choose the exact edition.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applyMatch.isPending}
            className="icon-btn disabled:opacity-40"
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
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
              }}
              placeholder="Artist, album or barcode…"
              className="input py-2.5 pr-3 pl-9 text-[13px]"
              aria-label="Search MusicBrainz manually"
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted/60">
            <Info size={11} />
            For “{title}” by {artist}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {debounced.length < 3 ? (
            <p className="px-5 py-14 text-center text-xs text-muted">
              Type at least 3 characters to search.
            </p>
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
              <p className="text-sm font-medium text-cream">No releases found</p>
              <p className="mt-1 text-xs text-muted">
                Try a shorter search, a barcode or a different edition.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {results.map((result) => {
                const active = result.musicbrainzId === selectedId;
                return (
                  <button
                    key={result.musicbrainzId}
                    type="button"
                    onClick={() => setSelectedId(result.musicbrainzId)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl p-2 text-left transition',
                      active
                        ? 'bg-accent/10 ring-1 ring-accent/35'
                        : 'hover:bg-white/[0.05]',
                    )}
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
                      <p className="truncate text-[11px] text-muted">{result.artist}</p>
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
                    <span
                      className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-full border transition',
                        active
                          ? 'border-accent bg-accent text-ink-950'
                          : 'border-white/15 text-transparent',
                      )}
                    >
                      <CheckCircle2 size={14} />
                    </span>
                  </button>
                );
              })}
              <p className="px-2 py-3 text-center text-[10px] text-muted/50">
                {results.length} editions · data from MusicBrainz
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">
              {selected ? (
                <>
                  <span className="text-cream">{selected.title}</span> · {selected.artist}
                </>
              ) : (
                'Select an edition to apply.'
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-muted/50">
              Cover and tracklist update; notes and purchase data stay.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applyMatch.isPending}
              className="btn btn-ghost py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => applyMatch.mutate()}
              disabled={!selectedId || applyMatch.isPending}
              className="btn btn-primary py-2"
            >
              {applyMatch.isPending && <Loader2 size={14} className="animate-spin" />}
              Apply metadata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
