import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  Disc3,
  ExternalLink,
  Loader2,
  Plus,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { ArtistReleaseGroup } from '@/lib/types';
import { cn, pluralize } from '@/lib/utils';
import { ArtistAvatar } from '@/components/artist-avatar';
import { CoverArt } from '@/components/cover-art';
import { useApp } from '@/components/app-context';
import { useToast } from '@/components/toast';

const LINK_LABELS: Record<string, string> = {
  'official homepage': 'Website',
  wikipedia: 'Wikipedia',
  discogs: 'Discogs',
  bandcamp: 'Bandcamp',
  allmusic: 'AllMusic',
  wikidata: 'Wikidata',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter',
  soundcloud: 'SoundCloud',
};

const TYPE_STYLES: Record<string, string> = {
  Album: 'border-accent/30 bg-accent/15 text-accent',
  EP: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  Single: 'border-white/15 bg-black/40 text-cream/80',
  Other: 'border-white/10 bg-black/40 text-muted',
};

const TYPE_ORDER = ['Album', 'EP', 'Single', 'Other'];

function categoryOf(group: ArtistReleaseGroup): string {
  if (group.primaryType === 'Album' && group.secondaryTypes.length === 0) {
    return 'Album';
  }
  if (group.primaryType === 'EP') return 'EP';
  if (group.primaryType === 'Single') return 'Single';
  return 'Other';
}

function typeLabel(type: string, count: number) {
  if (type === 'EP') return `EPs (${count})`;
  if (type === 'Single') return `Singles (${count})`;
  if (type === 'Album') return `Albums (${count})`;
  return `Other (${count})`;
}

function ArtistSkeleton() {
  return (
    <div className="pb-24">
      <div className="mt-5 skeleton h-3 w-28" />
      <div className="panel mt-4 p-6 md:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="skeleton h-32 w-32 rounded-full sm:h-40 sm:w-40" />
          <div className="flex-1">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-4 h-10 w-2/3" />
            <div className="skeleton mt-3 h-4 w-1/3" />
            <div className="skeleton mt-5 h-3 w-1/2" />
            <div className="skeleton mt-5 h-10 w-52 rounded-full" />
          </div>
        </div>
      </div>
      <div className="skeleton mt-8 h-4 w-32" />
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index}>
            <div className="skeleton aspect-square w-full rounded-xl" />
            <div className="skeleton mt-3 h-3 w-4/5" />
            <div className="skeleton mt-2 h-2.5 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReleaseGroupCard({
  group,
  onAdd,
}: {
  group: ArtistReleaseGroup;
  onAdd: (group: ArtistReleaseGroup) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(group)}
      className="group w-full text-left outline-none"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-black/40 transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl group-focus-visible:ring-2 group-focus-visible:ring-accent/60">
        <CoverArt
          src={group.coverUrl}
          title={group.title}
          className="h-full w-full transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        <span
          className={cn(
            'absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase backdrop-blur-md',
            TYPE_STYLES[group.primaryType] ?? TYPE_STYLES.Other,
          )}
        >
          {group.primaryType}
        </span>
        <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold text-ink-950 opacity-0 shadow-lg shadow-black/40 transition duration-300 group-hover:opacity-100">
          <Plus size={11} />
          Choose edition
        </span>
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-cream" title={group.title}>
        {group.title}
      </p>
      <p className="mt-0.5 truncate text-[10px] tracking-wide text-muted/60">
        {[group.year ? String(group.year) : null, ...group.secondaryTypes]
          .filter(Boolean)
          .join(' · ') || 'Year unknown'}
      </p>
    </button>
  );
}

export function ArtistPage() {
  const { mbid } = useParams();
  const { openAdd } = useApp();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [extraGroups, setExtraGroups] = useState<ArtistReleaseGroup[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setExtraGroups([]);
    setTypeFilter(null);
  }, [mbid]);

  const artistQuery = useQuery({
    queryKey: ['artist', mbid],
    queryFn: ({ signal }) => api.getArtist(mbid as string, signal),
    enabled: Boolean(mbid),
    retry: false,
    staleTime: 30 * 60_000,
  });

  const artist = artistQuery.data?.artist;

  const allGroups = useMemo(() => {
    const map = new Map<string, ArtistReleaseGroup>();
    for (const group of [
      ...(artist?.releaseGroups ?? []),
      ...extraGroups,
    ]) {
      map.set(group.id, group);
    }
    return [...map.values()].sort(
      (a, b) =>
        (b.firstReleaseDate ?? '').localeCompare(a.firstReleaseDate ?? '') ||
        a.title.localeCompare(b.title),
    );
  }, [artist, extraGroups]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of allGroups) {
      const category = categoryOf(group);
      map.set(category, (map.get(category) ?? 0) + 1);
    }
    return map;
  }, [allGroups]);

  if (artistQuery.isLoading) return <ArtistSkeleton />;

  if (artistQuery.isError || !artist) {
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
          <UserRound size={30} className="text-coral" />
          <h1 className="mt-4 font-display text-xl font-semibold text-cream">
            Could not open this artist
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {artistQuery.error instanceof Error
              ? artistQuery.error.message
              : 'The artist may no longer exist in MusicBrainz.'}
          </p>
          <Link to="/" className="btn btn-secondary mt-6">
            <ArrowLeft size={15} />
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  const defaultFilter = (counts.get('Album') ?? 0) > 0 ? 'Album' : 'all';
  const activeFilter = typeFilter ?? defaultFilter;
  const filteredGroups =
    activeFilter === 'all'
      ? allGroups
      : allGroups.filter((group) => categoryOf(group) === activeFilter);

  const lifespan = artist.beginYear
    ? `${artist.beginYear}${artist.endYear ? `–${artist.endYear}` : artist.ended ? '' : '–present'}`
    : null;
  const links = artist.links.slice(0, 5);

  function addReleaseGroup(group: ArtistReleaseGroup) {
    if (!artist) return;
    openAdd({
      query: `rgid:${group.id}`,
      display: `${artist.name} — ${group.title}`,
    });
  }

  function addByArtist() {
    if (!artist) return;
    openAdd({
      query: `artist:"${artist.name.replace(/"/g, '')}"`,
      display: artist.name,
    });
  }

  async function loadMore() {
    if (!artist || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.getArtistReleaseGroups(
        artist.id,
        allGroups.length,
        100,
      );
      setExtraGroups((current) => {
        const map = new Map(current.map((group) => [group.id, group]));
        for (const group of page.groups) map.set(group.id, group);
        return [...map.values()];
      });
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Could not load more release groups',
        'error',
      );
    } finally {
      setLoadingMore(false);
    }
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
          Artist
        </p>
      </div>

      <section className="panel relative mt-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.1] via-ink-900/70 to-ink-950" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end md:p-9">
          <ArtistAvatar
            name={artist.name}
            className="h-32 w-32 text-4xl sm:h-40 sm:w-40 sm:text-5xl"
          />
          <div className="min-w-0 flex-1 pb-1">
            <p className="eyebrow">
              {artist.type ?? 'Artist'}
              {artist.disambiguation ? ` · ${artist.disambiguation}` : ''}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight text-cream md:text-5xl">
              {artist.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {artist.country && <span>{artist.country}</span>}
              {artist.area && artist.area !== artist.country && (
                <span>{artist.area}</span>
              )}
              {lifespan && <span>{lifespan}</span>}
              <span>
                {artist.releaseGroupTotal > allGroups.length
                  ? `${allGroups.length} of ${artist.releaseGroupTotal} release groups`
                  : pluralize(allGroups.length, 'release group')}
              </span>
            </div>

            {artist.genres.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {artist.genres.slice(0, 8).map((genre) => (
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
                onClick={addByArtist}
                className="btn btn-primary"
              >
                <Plus size={15} />
                Add a release
              </button>
              <a
                href={`https://musicbrainz.org/artist/${artist.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                MusicBrainz
                <ExternalLink size={13} />
              </a>
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] text-muted transition hover:border-white/20 hover:text-cream"
                >
                  {LINK_LABELS[link.type] ?? link.type}
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Disc3 size={12} />
              Discography
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-cream">
              {activeFilter === 'all'
                ? 'Everything'
                : activeFilter === 'Other'
                  ? 'Other'
                  : `${activeFilter === 'EP' ? 'EP' : activeFilter}s`}
            </h2>
          </div>
          <p className="text-[11px] text-muted/60">
            {pluralize(filteredGroups.length, 'release group')}
            {allGroups.length < artist.releaseGroupTotal
              ? ` · ${allGroups.length} of ${artist.releaseGroupTotal} loaded`
              : ''}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={cn('chip', activeFilter === 'all' && 'chip-active')}
          >
            All ({allGroups.length})
          </button>
          {TYPE_ORDER.filter((type) => counts.has(type)).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn('chip', activeFilter === type && 'chip-active')}
            >
              {typeLabel(type, counts.get(type) ?? 0)}
            </button>
          ))}
        </div>

        {filteredGroups.length === 0 ? (
          <div className="panel mt-4 flex flex-col items-center px-6 py-14 text-center">
            <Disc3 size={24} className="text-muted/50" />
            <p className="mt-3 text-sm font-medium text-cream">
              Nothing in this category
            </p>
            <p className="mt-1 text-xs text-muted">
              Try another type or view all release groups.
            </p>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className="btn btn-secondary mt-4 py-2 text-xs"
            >
              View all
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredGroups.map((group) => (
              <ReleaseGroupCard
                key={group.id}
                group={group}
                onAdd={addReleaseGroup}
              />
            ))}
          </div>
        )}

        {allGroups.length < artist.releaseGroupTotal && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="btn btn-secondary"
            >
              {loadingMore ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ChevronDown size={14} />
              )}
              {loadingMore
                ? 'Loading…'
                : `Load more · ${allGroups.length} of ${artist.releaseGroupTotal}`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
