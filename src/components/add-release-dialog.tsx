import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Barcode,
  Check,
  ChevronRight,
  Disc3,
  Info,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import type { MbRelease, ReleasePayload } from '@/lib/types';
import {
  cn,
  CONDITIONS,
  CURRENCIES,
  FORMAT_OPTIONS,
  formatDuration,
  parsePriceInput,
  splitList,
  todayInputValue,
} from '@/lib/utils';
import { useApp } from './app-context';
import { CoverArt } from './cover-art';
import { useToast } from './toast';
import { FormatBadge } from './release-card';

type Tab = 'search' | 'manual';

type Draft = {
  format: string;
  condition: string;
  genres: string;
  notes: string;
  rating: number | null;
  purchaseDate: string;
  purchaseLocation: string;
  purchasePrice: string;
  purchaseCurrency: string;
};

type ManualDraft = {
  title: string;
  artist: string;
  year: string;
  format: string;
  condition: string;
  coverUrl: string;
  genres: string;
  notes: string;
  rating: number | null;
  purchaseDate: string;
  purchaseLocation: string;
  purchasePrice: string;
  purchaseCurrency: string;
};

const emptyManual: ManualDraft = {
  title: '',
  artist: '',
  year: '',
  format: 'CD',
  condition: 'Near Mint',
  coverUrl: '',
  genres: '',
  notes: '',
  rating: null,
  purchaseDate: '',
  purchaseLocation: '',
  purchasePrice: '',
  purchaseCurrency: 'EUR',
};

const emptyDraft: Draft = {
  format: 'CD',
  condition: 'Near Mint',
  genres: '',
  notes: '',
  rating: null,
  purchaseDate: '',
  purchaseLocation: '',
  purchasePrice: '',
  purchaseCurrency: 'EUR',
};



function Stars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const next = index + 1;
        return (
          <button
            key={next}
            type="button"
            onClick={() => onChange(value === next ? null : next)}
            className={cn(
              'text-lg leading-none transition',
              value && next <= value
                ? 'text-accent'
                : 'text-white/15 hover:text-white/30',
            )}
            aria-label={`Rate ${next} out of 5`}
          >
            ★
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-[10px] text-muted hover:text-cream"
        >
          clear
        </button>
      )}
    </div>
  );
}

export function AddReleaseDialog() {
  const { addOpen, closeAdd } = useApp();
  const { settings } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [manual, setManual] = useState<ManualDraft>(emptyManual);

  useEffect(() => {
    if (!addOpen) return;
    setTab('search');
    setQuery('');
    setDebounced('');
    setSelectedId(null);
    setDraft({
      ...emptyDraft,
      format: settings.defaultFormat,
      condition: settings.defaultCondition,
      purchaseCurrency: settings.defaultCurrency,
    });
    setManual({
      ...emptyManual,
      format: settings.defaultFormat,
      condition: settings.defaultCondition,
      purchaseCurrency: settings.defaultCurrency,
    });
  }, [addOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!addOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeAdd();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [addOpen, closeAdd]);

  const isBarcode = /^\d{8,14}$/.test(debounced);

  const searchQuery = useQuery({
    queryKey: ['mb-search', debounced, isBarcode],
    queryFn: () =>
      isBarcode
        ? api.searchBarcode(debounced)
        : api.searchMusicbrainz(debounced),
    enabled: addOpen && debounced.length >= 2,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ['mb-release', selectedId],
    queryFn: () => api.getMusicbrainzRelease(selectedId as string),
    enabled: addOpen && Boolean(selectedId),
    retry: false,
    staleTime: 10 * 60_000,
  });

  const detail = detailQuery.data?.release ?? null;

  useEffect(() => {
    if (!detail) return;
    setDraft({
      format: detail.format || settings.defaultFormat,
      condition: settings.defaultCondition,
      genres: detail.genres.join(', '),
      notes: '',
      rating: null,
      purchaseDate: '',
      purchaseLocation: '',
      purchasePrice: '',
      purchaseCurrency: settings.defaultCurrency,
    });
  }, [detail]);

  const createRelease = useMutation({
    mutationFn: (payload: ReleasePayload) => api.createRelease(payload),
    onSuccess: ({ release }) => {
      toast(`“${release.title}” added to your collection`, 'success');
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      closeAdd();
      navigate(`/releases/${release.id}`);
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not add this release',
        'error',
      );
    },
  });

  function saveFromMusicbrainz() {
    if (!detail) return;
    createRelease.mutate({
      musicbrainzId: detail.musicbrainzId,
      title: detail.title,
      artist: detail.artist,
      year: detail.year,
      releaseDate: detail.releaseDate,
      country: detail.country,
      label: detail.label,
      catalogNumber: detail.catalogNumber,
      barcode: detail.barcode,
      format: draft.format,
      formatDetail: detail.formatDetail,
      coverUrl: detail.coverUrl,
      notes: draft.notes.trim() || null,
      rating: draft.rating,
      condition: draft.condition || null,
      purchaseDate: draft.purchaseDate || null,
      purchaseLocation: draft.purchaseLocation.trim() || null,
      purchasePrice: parsePriceInput(draft.purchasePrice),
      purchaseCurrency: draft.purchasePrice
        ? draft.purchaseCurrency
        : null,
      genres: splitList(draft.genres),
      trackCount: detail.trackCount,
      tracks: detail.tracks.map((track) => ({
        position: track.position,
        disc: track.disc,
        number: track.number,
        title: track.title,
        duration: track.duration,
        artist: track.artist,
      })),
    });
  }

  function saveManual() {
    if (!manual.title.trim() || !manual.artist.trim()) {
      toast('Title and artist are required', 'error');
      return;
    }
    const year = Number.parseInt(manual.year, 10);
    createRelease.mutate({
      title: manual.title.trim(),
      artist: manual.artist.trim(),
      year: Number.isFinite(year) ? year : null,
      format: manual.format,
      condition: manual.condition || null,
      coverUrl: manual.coverUrl.trim() || null,
      genres: splitList(manual.genres),
      notes: manual.notes.trim() || null,
      rating: manual.rating,
      purchaseDate: manual.purchaseDate || null,
      purchaseLocation: manual.purchaseLocation.trim() || null,
      purchasePrice: parsePriceInput(manual.purchasePrice),
      purchaseCurrency: manual.purchasePrice
        ? manual.purchaseCurrency
        : null,
      trackCount: 0,
    });
  }

  if (!addOpen) return null;

  const results = searchQuery.data?.results ?? [];

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeAdd();
      }}
    >
      <div
        className="animate-scale-in flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/60 sm:max-h-[90vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Add a release"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">
              Add a release
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Pull metadata from MusicBrainz, or enter it yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAdd}
            className="icon-btn"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-white/[0.07] px-4 py-2.5">
          <button
            type="button"
            onClick={() => setTab('search')}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              tab === 'search'
                ? 'bg-white/10 text-cream'
                : 'text-muted hover:text-cream',
            )}
          >
            MusicBrainz search
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              tab === 'manual'
                ? 'bg-white/10 text-cream'
                : 'text-muted hover:text-cream',
            )}
          >
            Manual entry
          </button>
        </div>

        {tab === 'search' ? (
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:overflow-hidden">
            <div
              className={cn(
                'flex min-h-0 flex-col border-b border-white/[0.07] md:border-r md:border-b-0',
                selectedId && 'hidden md:flex',
              )}
            >
              <div className="shrink-0 border-b border-white/[0.06] p-4">
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
                    aria-label="Search MusicBrainz"
                  />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted/60">
                  <Barcode size={11} />
                  Paste a barcode (8–14 digits) to scan-match an edition.
                </p>
              </div>

              <div className="min-h-0 flex-1 p-2 md:overflow-y-auto">
                {debounced.length < 2 ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-muted">
                      <Search size={18} />
                    </span>
                    <p className="mt-4 text-sm font-medium text-cream">
                      Find your edition
                    </p>
                    <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
                      Search by artist and album. Sleeve will show every matching
                      pressing, format and year.
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
                    <p className="text-sm font-medium text-cream">
                      Search failed
                    </p>
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
                      Try a shorter search, or add this release manually.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('manual')}
                      className="btn btn-secondary mt-4"
                    >
                      Use manual entry
                    </button>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {results.map((result) => {
                      const active = selectedId === result.musicbrainzId;
                      const loading =
                        active && detailQuery.isFetching && !detailQuery.data;
                      return (
                        <button
                          key={result.musicbrainzId}
                          type="button"
                          onClick={() => setSelectedId(result.musicbrainzId)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl p-2 text-left transition',
                            active
                              ? 'bg-accent/10 ring-1 ring-accent/30'
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
                            <p className="truncate text-[11px] text-muted">
                              {result.artist}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-muted/60">
                              {[
                                result.year ?? undefined,
                                result.format,
                                result.trackCount
                                  ? `${result.trackCount} tracks`
                                  : undefined,
                                result.country ?? undefined,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          {loading ? (
                            <Loader2
                              size={15}
                              className="shrink-0 animate-spin text-accent"
                            />
                          ) : (
                            <ChevronRight
                              size={15}
                              className="shrink-0 text-muted/40"
                            />
                          )}
                        </button>
                      );
                    })}
                    <p className="px-2 py-3 text-center text-[10px] text-muted/50">
                      {results.length} editions · data from MusicBrainz
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                'min-h-0 p-5 md:overflow-y-auto',
                !selectedId && 'hidden md:block',
              )}
            >
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-cream md:hidden"
              >
                <ArrowLeft size={14} />
                Back to results
              </button>
              {!selectedId ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                  <div className="relative mb-5 grid h-24 w-24 place-items-center">
                    <span className="absolute inset-0 rounded-full border border-white/[0.07]" />
                    <span className="absolute inset-3 rounded-full border border-white/[0.08]" />
                    <span className="absolute inset-6 rounded-full border border-accent/20" />
                    <Disc3 size={26} className="text-accent/70" />
                  </div>
                  <p className="text-sm font-medium text-cream">
                    Pick an edition to preview
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                    You will be able to set the format, condition, rating and
                    notes before saving.
                  </p>
                </div>
              ) : detailQuery.isLoading || !detail ? (
                detailQuery.isError ? (
                  <div className="py-16 text-center">
                    <p className="text-sm font-medium text-cream">
                      Could not load this release
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {detailQuery.error instanceof Error
                        ? detailQuery.error.message
                        : 'Try another edition.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="skeleton h-28 w-28 rounded-xl" />
                      <div className="flex-1 pt-1">
                        <div className="skeleton h-4 w-4/5" />
                        <div className="skeleton mt-2.5 h-3 w-2/5" />
                        <div className="skeleton mt-4 h-2.5 w-3/5" />
                      </div>
                    </div>
                    <div className="skeleton h-10 w-full" />
                    <div className="skeleton h-10 w-full" />
                  </div>
                )
              ) : (
                <ReleaseEditor
                  detail={detail}
                  draft={draft}
                  setDraft={setDraft}
                  saving={createRelease.isPending}
                  onSave={saveFromMusicbrainz}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-2xl">
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-[11px] leading-relaxed text-muted">
                <Info size={14} className="mt-0.5 shrink-0 text-accent/70" />
                Manual entries are great for private pressings and oddities. You
                can always add cover art later.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-1">
                  <span className="field-label">Title *</span>
                  <input
                    autoFocus
                    value={manual.title}
                    onChange={(event) =>
                      setManual({ ...manual, title: event.target.value })
                    }
                    className="input"
                    placeholder="Kind of Blue"
                  />
                </label>
                <label className="sm:col-span-1">
                  <span className="field-label">Artist *</span>
                  <input
                    value={manual.artist}
                    onChange={(event) =>
                      setManual({ ...manual, artist: event.target.value })
                    }
                    className="input"
                    placeholder="Miles Davis"
                  />
                </label>
                <label>
                  <span className="field-label">Year</span>
                  <input
                    value={manual.year}
                    onChange={(event) =>
                      setManual({ ...manual, year: event.target.value })
                    }
                    className="input"
                    inputMode="numeric"
                    placeholder="1959"
                  />
                </label>
                <label>
                  <span className="field-label">Format</span>
                  <select
                    value={manual.format}
                    onChange={(event) =>
                      setManual({ ...manual, format: event.target.value })
                    }
                    className="input"
                  >
                    {FORMAT_OPTIONS.map((format) => (
                      <option key={format}>{format}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Condition</span>
                  <select
                    value={manual.condition}
                    onChange={(event) =>
                      setManual({ ...manual, condition: event.target.value })
                    }
                    className="input"
                  >
                    {CONDITIONS.map((condition) => (
                      <option key={condition}>{condition}</option>
                    ))}
                  </select>
                </label>

                <div className="mt-1 flex items-center gap-3 sm:col-span-2">
                  <span className="eyebrow">Purchase</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
                <label>
                  <span className="field-label">Purchase date</span>
                  <input
                    type="date"
                    value={manual.purchaseDate}
                    max={todayInputValue()}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        purchaseDate: event.target.value,
                      })
                    }
                    className="input"
                  />
                </label>
                <label>
                  <span className="field-label">Purchase location</span>
                  <input
                    value={manual.purchaseLocation}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        purchaseLocation: event.target.value,
                      })
                    }
                    className="input"
                    placeholder="Rough Trade, London"
                  />
                </label>
                <label>
                  <span className="field-label">Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={manual.purchasePrice}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        purchasePrice: event.target.value,
                      })
                    }
                    className="input"
                    placeholder="24.99"
                  />
                </label>
                <label>
                  <span className="field-label">Currency</span>
                  <select
                    value={manual.purchaseCurrency}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        purchaseCurrency: event.target.value,
                      })
                    }
                    className="input"
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="field-label">Cover image URL</span>
                  <input
                    value={manual.coverUrl}
                    onChange={(event) =>
                      setManual({ ...manual, coverUrl: event.target.value })
                    }
                    className="input"
                    placeholder="https://…"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="field-label">Genres (comma separated)</span>
                  <input
                    value={manual.genres}
                    onChange={(event) =>
                      setManual({ ...manual, genres: event.target.value })
                    }
                    className="input"
                    placeholder="Jazz, Modal"
                  />
                </label>
                <div className="sm:col-span-2">
                  <span className="field-label">Your rating</span>
                  <Stars
                    value={manual.rating}
                    onChange={(rating) =>
                      setManual({ ...manual, rating })
                    }
                  />
                </div>
                <label className="sm:col-span-2">
                  <span className="field-label">Notes</span>
                  <textarea
                    value={manual.notes}
                    onChange={(event) =>
                      setManual({ ...manual, notes: event.target.value })
                    }
                    className="input min-h-24 resize-y"
                    placeholder="Pressing details, where you found it, memories…"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdd}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveManual}
                  disabled={createRelease.isPending}
                  className="btn btn-primary"
                >
                  {createRelease.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  Add to collection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReleaseEditor({
  detail,
  draft,
  setDraft,
  saving,
  onSave,
}: {
  detail: MbRelease;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex gap-4">
        <CoverArt
          src={detail.coverUrl}
          title={detail.title}
          className="h-28 w-28 shrink-0 rounded-xl border border-white/10 shadow-lg shadow-black/30"
          iconSize={26}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <FormatBadge format={detail.format} />
            {detail.type && (
              <span className="text-[10px] text-muted/70">{detail.type}</span>
            )}
          </div>
          <h3 className="mt-2 truncate font-display text-lg font-semibold text-cream">
            {detail.title}
          </h3>
          <p className="truncate text-sm text-muted">{detail.artist}</p>
          <p className="mt-1.5 text-[11px] text-muted/70">
            {[
              detail.year ?? undefined,
              detail.label ?? undefined,
              detail.country ?? undefined,
              detail.trackCount ? `${detail.trackCount} tracks` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {detail.genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {detail.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] text-muted"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="divider my-5" />

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">Format</span>
          <select
            value={draft.format}
            onChange={(event) =>
              setDraft({ ...draft, format: event.target.value })
            }
            className="input"
          >
            {FORMAT_OPTIONS.map((format) => (
              <option key={format}>{format}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Condition</span>
          <select
            value={draft.condition}
            onChange={(event) =>
              setDraft({ ...draft, condition: event.target.value })
            }
            className="input"
          >
            {CONDITIONS.map((condition) => (
              <option key={condition}>{condition}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Genres (comma separated)</span>
          <input
            value={draft.genres}
            onChange={(event) =>
              setDraft({ ...draft, genres: event.target.value })
            }
            className="input"
            placeholder="Jazz, Modal"
          />
        </label>
        <div className="sm:col-span-2">
          <span className="field-label">Your rating</span>
          <Stars
            value={draft.rating}
            onChange={(rating) => setDraft({ ...draft, rating })}
          />
        </div>
        <label className="sm:col-span-2">
          <span className="field-label">Notes</span>
          <textarea
            value={draft.notes}
            onChange={(event) =>
              setDraft({ ...draft, notes: event.target.value })
            }
            className="input min-h-20 resize-y"
            placeholder="Pressing details, where you found it, memories…"
          />
        </label>

        <div className="mt-1 flex items-center gap-3 sm:col-span-2">
          <span className="eyebrow">Purchase</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <label>
          <span className="field-label">Purchase date</span>
          <input
            type="date"
            value={draft.purchaseDate}
            max={todayInputValue()}
            onChange={(event) =>
              setDraft({ ...draft, purchaseDate: event.target.value })
            }
            className="input"
          />
        </label>
        <label>
          <span className="field-label">Purchase location</span>
          <input
            value={draft.purchaseLocation}
            onChange={(event) =>
              setDraft({ ...draft, purchaseLocation: event.target.value })
            }
            className="input"
            placeholder="Rough Trade, London"
          />
        </label>
        <label>
          <span className="field-label">Price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.purchasePrice}
            onChange={(event) =>
              setDraft({ ...draft, purchasePrice: event.target.value })
            }
            className="input"
            placeholder="24.99"
          />
        </label>
        <label>
          <span className="field-label">Currency</span>
          <select
            value={draft.purchaseCurrency}
            onChange={(event) =>
              setDraft({ ...draft, purchaseCurrency: event.target.value })
            }
            className="input"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
      </div>

      {detail.tracks.length > 0 && (
        <details className="group mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted transition hover:text-cream">
            <span>Tracklist · {detail.tracks.length} tracks</span>
            <ChevronRight
              size={14}
              className="transition group-open:rotate-90"
            />
          </summary>
          <div className="max-h-52 overflow-y-auto border-t border-white/[0.06] px-3.5 py-2">
            {detail.tracks.map((track) => (
              <div
                key={`${track.position}-${track.title}`}
                className="flex items-center gap-3 py-1.5 text-[11px]"
              >
                <span className="w-5 shrink-0 tabular-nums text-muted/50">
                  {track.number ?? track.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-cream/80">
                  {track.title}
                </span>
                <span className="shrink-0 tabular-nums text-muted/50">
                  {formatDuration(track.duration)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[10px] leading-relaxed text-muted/50">
          Using edition {detail.musicbrainzId.slice(0, 8)}…
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} />
          )}
          Add to collection
        </button>
      </div>
    </div>
  );
}
