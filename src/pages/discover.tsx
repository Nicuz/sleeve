import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Compass, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { DiscoverReleaseGroup } from '@/lib/types';
import { pluralize } from '@/lib/utils';
import { useApp } from '@/components/app-context';
import { CoverArt } from '@/components/cover-art';
import { EmptyState } from '@/components/empty-state';

function DiscoverCard({
  group,
  genre,
  onAdd,
}: {
  group: DiscoverReleaseGroup;
  genre: string;
  onAdd: (group: DiscoverReleaseGroup) => void;
}) {
  return (
    <div className="group">
      <button
        type="button"
        onClick={() => onAdd(group)}
        className="relative block aspect-square w-full overflow-hidden rounded-xl border border-white/10   transition duration-300 outline-none group-hover:-translate-y-1 group-hover:border-white/20  group-focus-visible:ring-2 group-focus-visible:ring-accent/60"
        aria-label={`Add ${group.title} by ${group.artist}`}
      >
        <CoverArt
          src={group.coverUrl}
          title={group.title}
          className="h-full w-full transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        <span className="absolute top-2 left-2 rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-accent uppercase backdrop-blur-md">
          {group.primaryType}
        </span>
        <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold text-ink-950 opacity-0   transition duration-300 group-hover:opacity-100">
          <Plus size={11} />
          Add
        </span>
      </button>
      <p className="mt-3 truncate text-sm font-semibold text-cream" title={group.title}>
        {group.title}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        {group.artistId ? (
          <Link
            to={`/artists/${group.artistId}`}
            className="min-w-0 truncate text-xs text-muted transition hover:text-cream"
            title={group.artist}
          >
            {group.artist}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-xs text-muted">{group.artist}</span>
        )}
        {group.year && (
          <span className="shrink-0 text-[10px] text-muted/60">{group.year}</span>
        )}
      </div>
      <p className="mt-0.5 text-[10px] tracking-wide text-muted/50">
        {[genre, pluralize(group.releaseCount, 'edition')].join(' · ')}
      </p>
    </div>
  );
}

function DiscoverSkeleton() {
  return (
    <div className="pb-24">
      <div className="mt-8">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-4 h-10 w-1/2" />
        <div className="skeleton mt-3 h-3 w-2/5" />
      </div>
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="mt-10">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-3 h-7 w-24" />
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index}>
                <div className="skeleton aspect-square w-full rounded-xl" />
                <div className="skeleton mt-3 h-3 w-4/5" />
                <div className="skeleton mt-2 h-2.5 w-3/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscoverPage() {
  const { openAdd } = useApp();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['discover'],
    queryFn: api.discover,
    staleTime: 10 * 60_000,
  });

  function addGroup(group: DiscoverReleaseGroup) {
    openAdd({
      query: `rgid:${group.id}`,
      display: `${group.artist} — ${group.title}`,
    });
  }

  if (isLoading) return <DiscoverSkeleton />;

  if (isError || !data) {
    return (
      <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
        <Compass size={28} className="text-coral" />
        <p className="mt-3 text-sm font-medium text-cream">Could not load discovery</p>
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
    );
  }

  return (
    <div className="pb-24">
      <header className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Compass size={12} />
            Discover
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
            A wider groove.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            New artists and albums from the genres you collect — filtered to leave out the
            artists already on your shelves.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn btn-secondary self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {data.basedOn.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-[0.14em] text-muted/50 uppercase">
            Based on
          </span>
          {data.basedOn.map((genre) => (
            <span key={genre} className="chip cursor-default">
              {genre}
            </span>
          ))}
        </div>
      )}

      {data.basedOn.length === 0 ? (
        <div className="panel mt-8">
          <EmptyState
            icon={<Sparkles size={20} />}
            title="Discovery needs a few genres"
            description="Add records with genres to your library. Sleeve will use them to find new artists and albums."
            actionLabel="Add a release"
            onAction={() => openAdd()}
          />
        </div>
      ) : data.sections.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Compass size={28} className="text-muted/50" />
          <p className="mt-3 text-sm font-medium text-cream">
            No fresh suggestions right now
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            MusicBrainz did not return new artists for your top genres. Refresh in a
            little while.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-secondary mt-4"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Try again
          </button>
        </div>
      ) : (
        data.sections.map((section) => (
          <section key={section.genre} className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Because you collect</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-cream">
                  {section.genre}
                </h2>
              </div>
              <p className="text-[11px] text-muted/60">
                {pluralize(section.items.length, 'new artist')}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {section.items.map((group) => (
                <DiscoverCard
                  key={group.id}
                  group={group}
                  genre={section.genre}
                  onAdd={addGroup}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
