import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ChevronDown,
  CloudDownload,
  Disc3,
  Grid2x2,
  List,
  Plus,
  SearchX,
  Shuffle,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SORT_OPTIONS, useSettings } from '@/lib/settings';
import { cn, pluralize } from '@/lib/utils';
import { useApp } from '@/components/app-context';
import { EmptyState } from '@/components/empty-state';
import { ReleaseCard, ReleaseRow } from '@/components/release-card';
import { MetadataEnrichDialog } from '@/components/metadata-enrich-dialog';
import { ShuffleDialog } from '@/components/shuffle-dialog';

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  label: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index}>
          <div className="skeleton aspect-square w-full rounded-xl" />
          <div className="skeleton mt-3 h-3 w-4/5" />
          <div className="skeleton mt-2 h-2.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function LibraryPage() {
  const { openAdd } = useApp();
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [enrichOpen, setEnrichOpen] = useState(false);
  const openRelease = (id: string) => navigate(`/releases/${id}`);

  const q = params.get('q') ?? '';
  const format = params.get('format') ?? 'All';
  const genre = params.get('genre') ?? 'All';
  const decade = params.get('decade') ?? 'All';
  const missing = params.get('missing') ?? 'All';
  const sort = params.get('sort') ?? settings.defaultSort;
  const viewParam = params.get('view');
  const view =
    viewParam === 'list' || viewParam === 'grid' ? viewParam : settings.defaultView;

  const filters = { q, format, genre, decade, missing, sort };
  const releasesQuery = useQuery({
    queryKey: ['releases', filters],
    queryFn: () => api.listReleases(filters),
  });
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.stats(),
    staleTime: 60_000,
  });
  const metaQuery = useQuery({
    queryKey: ['meta'],
    queryFn: api.meta,
    staleTime: 60_000,
  });

  const stats = statsQuery.data;
  const releases = releasesQuery.data?.releases ?? [];
  const hasFilters =
    Boolean(q) ||
    format !== 'All' ||
    genre !== 'All' ||
    decade !== 'All' ||
    missing !== 'All';

  const formatOptions = [
    { value: 'All', label: 'All formats' },
    ...(stats?.byFormat ?? []).map((item) => ({
      value: item.format,
      label: `${item.format} (${item.count})`,
    })),
  ];

  function setParam(key: string, value: string, fallback = 'All') {
    const next = new URLSearchParams(params);
    if (!value || value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ['q', 'format', 'genre', 'decade', 'missing', 'sort']) {
      next.delete(key);
    }
    setParams(next, { replace: true });
  }

  return (
    <div className="pb-24">
      <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-accent/[0.13] via-ink-800/80 to-ink-900 px-6 py-8   md:px-10 md:py-11">
        <div className="pointer-events-none absolute -top-28 -right-20 hidden h-[360px] w-[360px] opacity-70 md:block">
          <div
            className="animate-spin-slow relative h-full w-full rounded-full border border-white/10 "
            style={{
              backgroundImage:
                'repeating-radial-gradient(circle at 50% 50%, #1c212b 0px, #1c212b 2px, #0a0c10 3px, #0a0c10 8px)',
            }}
          >
            <div className="absolute inset-0 m-auto grid h-28 w-28 place-items-center rounded-full bg-accent text-ink-950 ">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-950/15">
                <span className="h-2 w-2 rounded-full bg-ink-950/70" />
              </div>
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent" />
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="eyebrow flex items-center gap-2">
            <Sparkles size={12} />
            The listening room
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
            Your collection.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted md:text-[15px]">
            {stats?.total
              ? 'Everything you own, kept in one place.'
              : 'Start with a CD or a record. Sleeve pulls in the cover, label and tracklist for you.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              <Plus size={16} />
              Add a release
            </button>
            <Link to="/import/csv" className="btn btn-secondary">
              <Table2 size={15} />
              Import CSV
            </Link>
            <Link to="/stats" className="btn btn-secondary">
              View insights
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-8 sm:gap-12">
            {[
              { label: 'Releases', value: stats?.total ?? 0 },
              { label: 'Artists', value: stats?.totalArtists ?? 0 },
              { label: 'Tracks', value: stats?.totalTracks ?? 0 },
              { label: 'Formats', value: stats?.byFormat.length ?? 0 },
            ].map((item) => (
              <div key={item.label}>
                <p className="font-display text-2xl font-semibold text-cream/90 tabular-nums">
                  {statsQuery.isLoading ? '—' : item.value}
                </p>
                <p className="mt-0.5 text-[10px] tracking-[0.18em] text-muted/60 uppercase">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/[0.12] via-ink-900/70 to-ink-900/40 p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-accent/[0.08] blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/10 bg-ink-950/60  ">
              <Disc3 size={30} className="animate-spin-slow text-accent/80" />
            </span>
            <div>
              <p className="eyebrow">Shelf shuffle</p>
              <p className="mt-1 font-display text-lg font-semibold text-cream">
                Not sure what to play?
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Pull a random album from your shelf.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShuffleOpen(true)}
            disabled={!stats?.total}
            className="btn btn-primary self-start sm:self-auto"
          >
            <Shuffle size={15} />
            Pick a shuffle album
          </button>
        </div>
      </section>

      {stats && stats.missingMetadata > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <CloudDownload size={16} />
            </span>
            <div>
              <p className="text-xs font-medium text-cream">
                {pluralize(stats.missingMetadata, 'record')} missing metadata
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                Download cover art, tracklists and MusicBrainz IDs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnrichOpen(true)}
            className="btn btn-secondary shrink-0 py-2 text-xs"
          >
            Download metadata
          </button>
        </div>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Filter by format"
            value={format}
            onChange={(value) => setParam('format', value)}
            options={formatOptions}
          />
          <Select
            label="Filter by genre"
            value={genre}
            onChange={(value) => setParam('genre', value)}
            options={[
              { value: 'All', label: 'All genres' },
              ...(metaQuery.data?.genres ?? []).map((item) => ({
                value: item,
                label: item,
              })),
            ]}
          />
          <Select
            label="Filter by decade"
            value={decade}
            onChange={(value) => setParam('decade', value)}
            options={[
              { value: 'All', label: 'All decades' },
              ...(metaQuery.data?.decades ?? []).map((item) => ({
                value: String(item),
                label: `${item}s`,
              })),
            ]}
          />
          <Select
            label="Review missing info"
            value={missing}
            onChange={(value) => setParam('missing', value)}
            options={[
              { value: 'All', label: 'Nothing missing' },
              { value: 'genre', label: 'Missing genre' },
              { value: 'purchase', label: 'Missing price or date' },
              { value: 'metadata', label: 'Missing metadata' },
            ]}
          />
          <Select
            label="Sort releases"
            value={sort}
            onChange={(value) => setParam('sort', value, settings.defaultSort)}
            options={SORT_OPTIONS}
          />

          <div className="ml-auto flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={() => setParam('view', 'grid', settings.defaultView)}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition',
                view === 'grid'
                  ? 'bg-white/10 text-cream'
                  : 'text-muted hover:text-cream',
              )}
              aria-label="Grid view"
            >
              <Grid2x2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setParam('view', 'list', settings.defaultView)}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition',
                view === 'list'
                  ? 'bg-white/10 text-cream'
                  : 'text-muted hover:text-cream',
              )}
              aria-label="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xs text-muted">
            {releasesQuery.isLoading
              ? 'Loading the shelves…'
              : `${pluralize(releasesQuery.data?.count ?? 0, 'release')}${q ? ` for “${q}”` : ''}`}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-cream"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-4">
          {releasesQuery.isLoading ? (
            <LibrarySkeleton />
          ) : releasesQuery.isError ? (
            <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
              <SearchX size={26} className="text-coral" />
              <p className="text-sm font-medium text-cream">
                Could not load your library
              </p>
              <p className="max-w-sm text-xs text-muted">
                {releasesQuery.error instanceof Error
                  ? releasesQuery.error.message
                  : 'Check that the API is running and try again.'}
              </p>
              <button
                type="button"
                onClick={() => releasesQuery.refetch()}
                className="btn btn-secondary mt-2"
              >
                Try again
              </button>
            </div>
          ) : releases.length === 0 ? (
            hasFilters ? (
              <div className="panel">
                <EmptyState
                  icon={<SearchX size={20} />}
                  title="Nothing matches"
                  description="No releases match this search and these filters. Try a broader search or clear the filters."
                  actionLabel="Clear filters"
                  onAction={clearFilters}
                />
              </div>
            ) : (
              <div className="panel">
                <EmptyState
                  title="Your shelves are empty"
                  description="Add your first CD or record. Search MusicBrainz and Sleeve fills in the cover art, label, year and tracklist."
                  actionLabel="Add your first release"
                  onAction={openAdd}
                />
              </div>
            )
          ) : view === 'list' ? (
            <div className="panel divide-y divide-white/[0.04] p-1.5">
              {releases.map((release) => (
                <ReleaseRow key={release.id} release={release} onOpen={openRelease} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {releases.map((release) => (
                <ReleaseCard key={release.id} release={release} onOpen={openRelease} />
              ))}
            </div>
          )}
        </div>
      </section>

      {stats && stats.total > 0 && (
        <section className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-accent">
              <Disc3 size={17} />
            </span>
            <div>
              <p className="text-sm font-medium text-cream">
                Your insights get richer with every record.
              </p>
              <p className="text-xs text-muted">
                Formats, eras, artists and the shape of your collection.
              </p>
            </div>
          </div>
          <Link
            to="/stats"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-accent-soft"
          >
            Open insights
            <ArrowUpRight size={14} />
          </Link>
        </section>
      )}

      <ShuffleDialog open={shuffleOpen} onClose={() => setShuffleOpen(false)} />
      <MetadataEnrichDialog open={enrichOpen} onClose={() => setEnrichOpen(false)} />
    </div>
  );
}
