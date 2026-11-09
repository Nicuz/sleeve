import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Disc3,
  ListMusic,
  Sparkles,
  Tags,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import type { StatsRange } from '@/lib/types';
import { cn, pluralize } from '@/lib/utils';
import { useApp } from '@/components/app-context';
import { EmptyState } from '@/components/empty-state';
import { SpendingInsights } from '@/components/spending-insights';

const formatColor: Record<string, string> = {
  CD: 'bg-accent',
  Vinyl: 'bg-coral',
  Cassette: 'bg-sky-400',
  Digital: 'bg-violet-400',
  Other: 'bg-white/40',
};

const formatDot: Record<string, string> = {
  CD: 'bg-accent',
  Vinyl: 'bg-coral',
  Cassette: 'bg-sky-400',
  Digital: 'bg-violet-400',
  Other: 'bg-white/40',
};

function StatCard({
  icon: Icon,
  value,
  hint,
}: {
  icon: LucideIcon;
  value: number;
  hint: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.07] bg-white/[0.03] text-accent">
          <Icon size={16} />
        </span>
        <span className="text-sm font-medium text-cream">
          {hint}
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tabular-nums text-cream">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('panel p-6', className)}>
      <div className="skeleton h-4 w-28" />
      <div className="skeleton mt-6 h-32 w-full" />
      <div className="skeleton mt-4 h-3 w-3/4" />
    </div>
  );
}

const RANGES: Array<{ value: StatsRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'year', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
];

export function StatsPage() {
  const { openAdd } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'spending' ? 'spending' : 'collection';
  const spending = tab === 'spending';
  const rangeParam = params.get('range');
  const range: StatsRange =
    rangeParam === 'year' || rangeParam === '12m' ? rangeParam : 'all';

  function changeRange(next: StatsRange) {
    const query = new URLSearchParams(params);
    if (next === 'all') query.delete('range');
    else query.set('range', next);
    setParams(query, { replace: true });
  }

  function tabSearch(next: 'overview' | 'spending') {
    const query = new URLSearchParams(params);
    if (next === 'spending') query.set('tab', 'spending');
    else query.delete('tab');
    const search = query.toString();
    return { pathname: '/stats', search: search ? `?${search}` : '' };
  }

  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stats', range],
    queryFn: () => api.stats(range),
    staleTime: 60_000,
  });

  const maxDecade = Math.max(1, ...(stats?.byDecade.map((item) => item.count) ?? [1]));
  const maxArtist = Math.max(
    1,
    ...(stats?.topArtists.map((item) => item.count) ?? [1]),
  );
  const topFormat = stats?.byFormat[0];
  const topDecade = stats?.byDecade.length
    ? [...stats.byDecade].sort((a, b) => b.count - a.count)[0]
    : undefined;
  const topGenre = stats?.topGenres[0];
  const attention = stats
    ? [
        {
          count: stats.missingMetadata,
          label: 'Missing cover, tracks or MusicBrainz ID',
          hint: 'Incomplete release metadata',
          missing: 'metadata',
        },
        {
          count: stats.missingGenre,
          label: 'Missing genre',
          hint: 'Add genres when editing a release',
          missing: 'genre',
        },
        {
          count: stats.missingPurchaseInfo,
          label: 'Missing price or purchase date',
          hint: 'Needed for spending insights',
          missing: 'purchase',
        },
      ].filter((item) => item.count > 0)
    : [];

  return (
    <div className="pb-24">
      <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            {spending ? <Wallet size={12} /> : <Sparkles size={12} />}
            {spending ? 'Spending insights' : 'Collection insights'}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
            {spending ? 'Where the money went.' : 'The shape of your sound.'}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            {spending
              ? 'How much you invest, when you buy and where your records come from.'
              : 'A read on what is on your shelves — formats, eras, artists and the genres you keep coming back to.'}
          </p>
        </div>
        <Link to="/" className="btn btn-secondary self-start sm:self-auto">
          <ArrowLeft size={15} />
          Back to library
        </Link>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
          <Link
            to={tabSearch('overview')}
            aria-current={!spending ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              !spending
                ? 'bg-white/10 text-cream'
                : 'text-muted hover:text-cream',
            )}
          >
            <Disc3 size={13} />
            Overview
          </Link>
          <Link
            to={tabSearch('spending')}
            aria-current={spending ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              spending
                ? 'bg-white/10 text-cream'
                : 'text-muted hover:text-cream',
            )}
          >
            <Wallet size={13} />
            Spending
          </Link>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted/60 uppercase">
            Period
          </span>
          <span className="relative">
            <select
              value={range}
              onChange={(event) =>
                changeRange(event.target.value as StatsRange)
              }
              className="select w-40 pr-8 text-xs"
              aria-label="Insights period"
            >
              {RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
            />
          </span>
        </label>
      </div>

      {spending ? (
        <SpendingInsights range={range} />
      ) : isLoading ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="panel p-5">
                <div className="skeleton h-9 w-9 rounded-full" />
                <div className="skeleton mt-4 h-8 w-20" />
                <div className="skeleton mt-2 h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        </>
      ) : isError || !stats ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Disc3 size={28} className="text-coral" />
          <p className="mt-3 text-sm font-medium text-cream">
            Could not load insights
          </p>
          <p className="mt-1 text-xs text-muted">
            {error instanceof Error ? error.message : 'Try again in a moment.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-secondary mt-4"
          >
            Try again
          </button>
        </div>
      ) : stats.total === 0 ? (
        <div className="panel mt-8">
          <EmptyState
            title={range === 'all' ? 'No data yet' : 'Nothing in this period'}
            description={
              range === 'all'
                ? 'Add a few records and this page will start drawing the shape of your collection — formats, decades and favourite artists.'
                : 'No records were added in the selected period. Try a wider range.'
            }
            actionLabel={range === 'all' ? 'Add your first release' : 'Add a release'}
            onAction={openAdd}
          />
        </div>
      ) : (
        <>
          {topFormat && (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
              <span className="text-cream">{topFormat.format}</span> leads your
              shelf
              {topDecade
                ? `, the ${topDecade.decade} is the most represented era`
                : ''}
              {topGenre ? `, and ${topGenre.genre} is the top genre` : ''}.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Disc3}
              value={stats.total}
              hint="Releases"
            />
            <StatCard
              icon={Users}
              value={stats.totalArtists}
              hint="Artists"
            />
            <StatCard
              icon={ListMusic}
              value={stats.totalTracks}
              hint="Tracks"
            />
            <StatCard
              icon={Tags}
              value={stats.totalGenres}
              hint="Genres"
            />
          </div>

          {attention.length > 0 && (
            <section className="panel mt-3 p-4 sm:p-5">
              <p className="eyebrow">Needs attention</p>
              <ul className="mt-2 divide-y divide-white/[0.04]">
                {attention.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-xs font-medium text-cream">
                        {pluralize(item.count, 'record')} · {item.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {item.hint}
                      </p>
                    </div>
                    <Link
                      to={`/?missing=${item.missing}`}
                      className="shrink-0 text-[11px] font-medium text-accent transition hover:text-accent-soft"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel mt-3 p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-cream">
                  By format
                </h2>
              </div>
              <div className="mt-6 space-y-4">
                {stats.byFormat.map((item) => {
                  const percent = Math.round((item.count / stats.total) * 100);
                  return (
                    <Link
                      key={item.format}
                      to={`/?format=${encodeURIComponent(item.format)}`}
                      className="group block rounded-lg py-0.5 transition hover:bg-white/[0.02]"
                    >
                      <div className="mb-1.5 flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            formatDot[item.format] ?? formatDot.Other,
                          )}
                        />
                        <span className="text-cream/80 transition group-hover:text-cream">
                          {item.format}
                        </span>
                        <span className="ml-auto tabular-nums text-muted">
                          {item.count}
                          <span className="ml-1.5 text-muted/50">
                            {percent}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-700',
                            formatColor[item.format] ?? formatColor.Other,
                          )}
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="lg:border-l lg:border-white/[0.06] lg:pl-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-cream">
                  By decade
                </h2>
                <span className="text-[10px] text-muted/60">
                  {stats.byDecade.length} eras
                </span>
              </div>
              {stats.byDecade.length === 0 ? (
                <p className="mt-8 text-xs text-muted">
                  Add release years to see your collection across the decades.
                </p>
              ) : (
                <div className="mt-6 overflow-x-auto pb-1">
                  <div className="flex h-36 min-w-full items-stretch gap-2 sm:gap-3">
                    {stats.byDecade.map((item) => {
                      const height = Math.max(
                        6,
                        Math.round((item.count / maxDecade) * 100),
                      );
                      return (
                        <Link
                          key={item.decade}
                          to={`/?decade=${item.value}`}
                          className="group flex h-full min-w-[34px] flex-1 flex-col items-center gap-2"
                          title={`${item.decade}: ${item.count}`}
                        >
                          <span className="text-[10px] tabular-nums text-muted/70">
                            {item.count}
                          </span>
                          <div className="flex w-full flex-1 items-end">
                            <div
                              className="w-full rounded-t-md bg-gradient-to-t from-accent/20 to-accent/80 transition-all duration-500 group-hover:from-accent/30 group-hover:to-accent"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <span className="text-[9px] tracking-wide text-muted/50 transition group-hover:text-cream">
                            {`’${String(item.value).slice(2)}s`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            </div>
          </section>

          <section className="panel mt-3 p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-cream">
                  Most collected artists
                </h2>
                <span className="text-[10px] text-muted/60">
                  Top {Math.min(6, stats.topArtists.length)}
                </span>
              </div>
              <ol className="mt-4 space-y-1">
                {stats.topArtists.map((item, index) => {
                  const row = (
                    <>
                      <span className="w-5 text-[10px] tabular-nums text-muted/40">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-cream/90">
                        {item.artist}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] tabular-nums text-muted">
                        {item.count}
                      </span>
                      {item.artistId && (
                        <ArrowUpRight
                          size={12}
                          className="shrink-0 text-muted/40 opacity-0 transition group-hover:opacity-100"
                        />
                      )}
                    </>
                  );
                  return (
                    <li
                      key={item.artistId ?? item.artist}
                      className="relative overflow-hidden rounded-lg"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-accent/[0.06]"
                        style={{ width: `${(item.count / maxArtist) * 100}%` }}
                      />
                      {item.artistId ? (
                        <Link
                          to={`/artists/${item.artistId}`}
                          className="group relative flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className="relative flex items-center gap-3 px-3 py-2.5">
                          {row}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="lg:border-l lg:border-white/[0.06] lg:pl-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-cream">
                  Genres in rotation
                </h2>
              </div>
              {stats.topGenres.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <Tags size={20} className="mx-auto text-muted/50" />
                  <p className="mt-2 text-xs text-muted">
                    No genres yet. Add some when you edit a release.
                  </p>
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap gap-2">
                  {stats.topGenres.map((item, index) => (
                    <Link
                      key={item.genre}
                      to={`/?genre=${encodeURIComponent(item.genre)}`}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition hover:border-white/20',
                        index < 3
                          ? 'border-accent/25 bg-accent/[0.08] text-cream'
                          : 'border-white/10 bg-white/[0.02] text-muted',
                      )}
                    >
                      {item.genre}
                      <span
                        className={cn(
                          'text-[10px] tabular-nums',
                          index < 3 ? 'text-accent/80' : 'text-muted/60',
                        )}
                      >
                        {item.count}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
