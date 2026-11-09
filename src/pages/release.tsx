import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Disc3,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  cn,
  CONDITIONS,
  CURRENCIES,
  FORMAT_OPTIONS,
  formatDate,
  formatDuration,
  formatPrice,
  formatTotalDuration,
  parseGenres,
  parsePriceInput,
  splitList,
  todayInputValue,
} from '@/lib/utils';
import { CoverArt } from '@/components/cover-art';
import { FormatBadge } from '@/components/release-card';
import { useToast } from '@/components/toast';

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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-semibold tracking-[0.16em] text-muted/50 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-xs text-cream/80" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ReleaseSkeleton() {
  return (
    <div className="pb-24">
      <div className="mt-5 skeleton h-3 w-28" />
      <div className="panel mt-4 overflow-hidden p-6 md:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="skeleton h-44 w-44 shrink-0 rounded-2xl sm:h-56 sm:w-56" />
          <div className="flex-1 pb-1">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton mt-4 h-10 w-3/4" />
            <div className="skeleton mt-3 h-4 w-1/3" />
            <div className="skeleton mt-5 h-3 w-2/3" />
            <div className="skeleton mt-6 h-10 w-56 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="panel p-5">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-5 h-64 w-full" />
        </div>
        <div className="panel p-5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-5 h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ReleasePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const releaseQuery = useQuery({
    queryKey: ['release', id],
    queryFn: () => api.getRelease(id as string),
    enabled: Boolean(id),
    retry: false,
  });

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setDraft(null);
  }, [id]);

  const updateRelease = useMutation({
    mutationFn: (payload: {
      format: string;
      condition: string | null;
      genres: string[];
      notes: string | null;
      rating: number | null;
      purchaseDate: string | null;
      purchaseLocation: string | null;
      purchasePrice: number | null;
      purchaseCurrency: string | null;
    }) => api.updateRelease(id as string, payload),
    onSuccess: ({ release }) => {
      queryClient.setQueryData(['release', id], { release });
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      setEditing(false);
      toast('Release details updated', 'success');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not save changes',
        'error',
      );
    },
  });

  const refreshMetadata = useMutation({
    mutationFn: () => api.refreshRelease(id as string),
    onSuccess: ({ release }) => {
      queryClient.setQueryData(['release', id], { release });
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.invalidateQueries({ queryKey: ['discover'] });
      toast('Metadata refreshed from MusicBrainz', 'success');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not refresh metadata',
        'error',
      );
    },
  });

  const deleteRelease = useMutation({
    mutationFn: () => api.deleteRelease(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.removeQueries({ queryKey: ['release', id] });
      toast('Removed from your collection', 'info');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not remove release',
        'error',
      );
    },
  });

  if (releaseQuery.isLoading) return <ReleaseSkeleton />;

  const release = releaseQuery.data?.release;

  if (releaseQuery.isError || !release) {
    return (
      <div className="pb-24">
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-muted transition hover:text-cream"
        >
          <ArrowLeft size={14} />
          Back to library
        </Link>
        <div className="panel mt-4 flex flex-col items-center px-6 py-20 text-center">
          <Disc3 size={30} className="text-coral" />
          <h1 className="mt-4 font-display text-xl font-semibold text-cream">
            Could not open this release
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {releaseQuery.error instanceof Error
              ? releaseQuery.error.message
              : 'It may have been removed from your collection.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-secondary mt-6"
          >
            <ArrowLeft size={15} />
            Back to library
          </button>
        </div>
      </div>
    );
  }

  const genres = parseGenres(release.genres);
  const tracks = release.tracks ?? [];
  const totalDuration = tracks.reduce(
    (sum, track) => sum + (track.duration ?? 0),
    0,
  );
  const hasPurchase = Boolean(
    release.purchaseDate ||
      release.purchaseLocation ||
      release.purchasePrice !== null,
  );

  function startEdit() {
    if (!release) return;
    setDraft({
      format: release.format,
      condition: release.condition ?? 'Near Mint',
      genres: genres.join(', '),
      notes: release.notes ?? '',
      rating: release.rating,
      purchaseDate: release.purchaseDate ?? '',
      purchaseLocation: release.purchaseLocation ?? '',
      purchasePrice:
        release.purchasePrice !== null ? String(release.purchasePrice) : '',
      purchaseCurrency: release.purchaseCurrency ?? 'EUR',
    });
    setEditing(true);
    setConfirmDelete(false);
  }

  function saveEdit() {
    if (!draft) return;
    updateRelease.mutate({
      format: draft.format,
      condition: draft.condition || null,
      genres: splitList(draft.genres),
      notes: draft.notes.trim() || null,
      rating: draft.rating,
      purchaseDate: draft.purchaseDate || null,
      purchaseLocation: draft.purchaseLocation.trim() || null,
      purchasePrice: parsePriceInput(draft.purchasePrice),
      purchaseCurrency: draft.purchasePrice ? draft.purchaseCurrency : null,
    });
  }

  return (
    <div className="pb-24">
      <div className="mt-5 flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted transition hover:text-cream"
        >
          <ArrowLeft size={14} />
          Back to library
        </Link>
        <p className="text-[10px] tracking-[0.18em] text-muted/40 uppercase">
          Release
        </p>
      </div>

      <section className="panel relative mt-4 overflow-hidden">
        <div className="absolute inset-0">
          {release.coverUrl ? (
            <img
              src={release.coverUrl}
              alt=""
              className="h-full w-full scale-125 object-cover opacity-25 blur-3xl"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-accent/20 to-transparent" />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.08] via-ink-900/75 to-ink-950" />
        </div>

        <div className="pointer-events-none absolute top-1/2 right-12 hidden h-56 w-56 -translate-y-1/2 opacity-40 min-[1280px]:block">
          <div
            className="animate-spin-slow relative h-full w-full rounded-full border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]"
            style={{
              backgroundImage:
                'repeating-radial-gradient(circle at 50% 50%, #1c212b 0px, #1c212b 2px, #0a0c10 3px, #0a0c10 8px)',
            }}
          >
            <div className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-ink-950">
              <span className="h-2 w-2 rounded-full bg-ink-950/70" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent" />
          </div>
        </div>

        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end md:p-9">
          <CoverArt
            src={release.coverUrl}
            title={release.title}
            className="h-44 w-44 shrink-0 rounded-2xl border border-white/15 shadow-2xl shadow-black/50 sm:h-56 sm:w-56"
            iconSize={46}
          />
          <div className="min-w-0 flex-1 pb-1">
            <p className="eyebrow flex items-center gap-2">
              <Disc3 size={12} />
              On the shelf
              {release.year ? ` · ${release.year}` : ''}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight text-cream md:text-5xl">
              {release.title}
            </h1>
            <p className="mt-2 text-base text-muted md:text-lg">
              {release.artistId ? (
                <Link
                  to={`/artists/${release.artistId}`}
                  className="underline-offset-4 transition hover:text-cream hover:underline"
                >
                  {release.artist}
                </Link>
              ) : (
                release.artist
              )}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FormatBadge format={release.format} />
              {release.condition && (
                <span className="chip cursor-default">{release.condition}</span>
              )}
              {release.trackCount ? (
                <span className="chip cursor-default">
                  {release.trackCount} tracks
                </span>
              ) : null}
              {totalDuration > 0 && (
                <span className="chip cursor-default">
                  {formatTotalDuration(totalDuration)}
                </span>
              )}
              {release.rating && (
                <span className="chip chip-active cursor-default">
                  <Star size={11} className="fill-current" />
                  {release.rating}/5
                </span>
              )}
            </div>

            {genres.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {genres.slice(0, 8).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 text-[9px] text-muted/80"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="btn btn-primary"
              >
                <Pencil size={15} />
                Edit details
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(true);
                  setEditing(false);
                }}
                className="btn btn-secondary hover:border-red-400/30 hover:text-red-300"
              >
                <Trash2 size={15} />
                Remove
              </button>
              {release.musicbrainzId && (
                <button
                  type="button"
                  onClick={() => refreshMetadata.mutate()}
                  disabled={refreshMetadata.isPending}
                  className="btn btn-ghost"
                >
                  {refreshMetadata.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Refresh
                </button>
              )}
              {release.musicbrainzId && (
                <a
                  href={`https://musicbrainz.org/release/${release.musicbrainzId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                >
                  MusicBrainz
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {confirmDelete && (
        <div className="animate-fade-in mt-3 flex flex-col gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.07] p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-200">
              Remove “{release.title}” from your collection?
            </p>
            <p className="mt-1 text-[11px] text-red-200/60">
              This deletes the release and its tracklist from your library.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => deleteRelease.mutate()}
              disabled={deleteRelease.isPending}
              className="btn btn-danger py-2 text-xs"
            >
              {deleteRelease.isPending && (
                <Loader2 size={12} className="animate-spin" />
              )}
              Yes, remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn btn-ghost py-2 text-xs"
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {editing && draft && (
        <section className="animate-fade-in panel mt-3 border-accent/20 bg-accent/[0.04] p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-cream">
              Edit details
            </h2>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="icon-btn h-8 w-8"
              aria-label="Cancel editing"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-1">
              <span className="field-label">Your rating</span>
              <div className="flex h-10 items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => {
                  const next = index + 1;
                  return (
                    <button
                      key={next}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          rating: draft.rating === next ? null : next,
                        })
                      }
                      className={cn(
                        'text-xl leading-none transition',
                        draft.rating && next <= draft.rating
                          ? 'text-accent'
                          : 'text-white/15 hover:text-white/30',
                      )}
                      aria-label={`Rate ${next} out of 5`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
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

            <div className="mt-1 flex items-center gap-3 sm:col-span-2 lg:col-span-4">
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
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={updateRelease.isPending}
              className="btn btn-primary py-2"
            >
              {updateRelease.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Save changes
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="font-display text-base font-semibold text-cream">
              Tracklist
            </h2>
            <p className="text-[10px] text-muted/60">
              {tracks.length} tracks
              {totalDuration > 0
                ? ` · ${formatTotalDuration(totalDuration)}`
                : ''}
            </p>
          </div>

          {tracks.length === 0 ? (
            <p className="px-5 py-12 text-center text-xs text-muted">
              No tracklist saved for this release.
            </p>
          ) : (
            <div>
              {tracks.map((track, index) => {
                const previous = tracks[index - 1];
                const showDisc =
                  track.disc && track.disc !== 1 && track.disc !== previous?.disc;
                return (
                  <div key={track.id}>
                    {showDisc && (
                      <p className="border-y border-white/[0.05] bg-white/[0.025] px-5 py-1.5 text-[9px] font-semibold tracking-[0.18em] text-muted/60 uppercase">
                        Disc {track.disc}
                      </p>
                    )}
                    <div className="flex items-center gap-4 border-b border-white/[0.04] px-5 py-3 last:border-b-0">
                      <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted/40">
                        {track.number ?? index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-cream/90">
                          {track.title}
                        </p>
                        {track.artist && track.artist !== release.artist && (
                          <p className="truncate text-[11px] text-muted/60">
                            {track.artist}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted/50">
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <h2 className="font-display text-base font-semibold text-cream">
              Release details
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
              <MetaRow label="Label" value={release.label ?? '—'} />
              <MetaRow
                label="Catalog no."
                value={release.catalogNumber ?? '—'}
              />
              <MetaRow
                label="Released"
                value={release.releaseDate ?? String(release.year ?? '—')}
              />
              <MetaRow label="Country" value={release.country ?? '—'} />
              <MetaRow label="Barcode" value={release.barcode ?? '—'} />
              <MetaRow label="Added" value={formatDate(release.createdAt)} />
              {release.formatDetail &&
                release.formatDetail !== release.format && (
                  <div className="col-span-2">
                    <MetaRow
                      label="Edition format"
                      value={release.formatDetail}
                    />
                  </div>
                )}
              <div className="col-span-2">
                <MetaRow
                  label="Source"
                  value={release.musicbrainzId ? 'MusicBrainz' : 'Manual entry'}
                />
              </div>
            </dl>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-cream">
                Purchase
              </h2>
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 text-[10px] text-muted transition hover:text-cream"
              >
                <Pencil size={11} />
                Edit
              </button>
            </div>
            {hasPurchase ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
                <MetaRow
                  label="Bought on"
                  value={formatDate(release.purchaseDate)}
                />
                <MetaRow
                  label="Price"
                  value={formatPrice(
                    release.purchasePrice,
                    release.purchaseCurrency,
                  )}
                />
                <div className="col-span-2">
                  <MetaRow
                    label="Location"
                    value={release.purchaseLocation ?? '—'}
                  />
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                No purchase details yet. Add the date, shop and price from Edit
                details.
              </p>
            )}
          </section>

          {release.notes && (
            <section className="panel p-5">
              <h2 className="font-display text-base font-semibold text-cream">
                Notes
              </h2>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-cream/70">
                {release.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
