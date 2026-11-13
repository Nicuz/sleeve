import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  Clock,
  Compass,
  Disc3,
  ExternalLink,
  Headphones,
  Heart,
  Search,
  Sparkles,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type {
  ArtistSearchResult,
  DiscoveryItem,
  FollowedArtist,
  SavedSuggestion,
} from '@/lib/types';
import { formatDate, pluralize } from '@/lib/utils';
import { useApp } from '@/components/app-context';
import { ArtistAvatar } from '@/components/artist-avatar';
import { CardHalo } from '@/components/card-halo';
import { CoverArt } from '@/components/cover-art';
import { EmptyState } from '@/components/empty-state';
import { FollowArtistButton } from '@/components/follow-artist-button';
import { SuggestionDialog } from '@/components/suggestion-dialog';
import { useToast } from '@/components/toast';

function updatedLabel(iso: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

function nextRefreshLabel(iso?: string): string {
  if (!iso) return 'Automatic';
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Soon';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function nextRefreshDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function DiscoverCard({
  item,
  onOpen,
}: {
  item: DiscoveryItem;
  onOpen: (item: DiscoveryItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      aria-label={`Open ${item.title} by ${item.artist}`}
    >
      <CardHalo />
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <CoverArt src={item.coverUrl} title={item.title} className="h-full w-full" />
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-cream" title={item.title}>
        {item.title}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">{item.artist}</p>
      <p className="mt-0.5 text-[11px] text-muted">
        {[item.year, item.primaryType].filter(Boolean).join(' · ')}
      </p>
      <p className="mt-1 line-clamp-1 text-[11px] text-muted">{item.reason}</p>
    </button>
  );
}

function SavedCard({
  item,
  onPromote,
  onRemove,
  busy,
}: {
  item: SavedSuggestion;
  onPromote: (item: SavedSuggestion) => void;
  onRemove: (item: SavedSuggestion) => void;
  busy: boolean;
}) {
  return (
    <div className="group">
      <CoverArt
        src={item.coverUrl}
        title={item.title}
        className="aspect-square w-full rounded-xl"
      />
      <p className="mt-3 truncate text-sm font-semibold text-cream" title={item.title}>
        {item.title}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted">{item.artist}</span>
        {item.year && (
          <span className="shrink-0 text-[11px] text-muted">{item.year}</span>
        )}
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
        {item.type}
      </p>
      <div className="mt-2 flex items-center gap-3 text-[10px]">
        <button
          type="button"
          onClick={() => onPromote(item)}
          disabled={busy}
          className="inline-flex items-center gap-1 font-medium text-accent transition hover:text-accent-soft disabled:opacity-50"
        >
          <Heart size={11} />
          Move to wishlist
        </button>
        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={busy}
          className="inline-flex items-center gap-1 text-muted transition hover:text-coral disabled:opacity-50"
        >
          <X size={11} />
          Remove
        </button>
      </div>
    </div>
  );
}

function FollowingRow({
  artist,
  onUnfollow,
  busy,
}: {
  artist: FollowedArtist;
  onUnfollow: (artist: FollowedArtist) => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/10">
      <Link
        to={`/artists/${artist.artistId}`}
        className="group flex min-w-0 flex-1 items-center gap-3"
      >
        <ArtistAvatar name={artist.name} className="h-10 w-10 text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-cream transition group-hover:text-accent">
            {artist.name}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">
            Followed {formatDate(artist.createdAt)}
            {artist.ownedCount
              ? ` · ${pluralize(artist.ownedCount, 'release')} in library`
              : ' · not in library'}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onUnfollow(artist)}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-muted transition hover:border-coral/30 hover:bg-coral/10 hover:text-coral disabled:opacity-50"
      >
        <UserMinus size={11} />
        Unfollow
      </button>
    </div>
  );
}

function artistMeta(artist: ArtistSearchResult): string {
  return (
    [
      artist.disambiguation,
      artist.type,
      artist.country ?? artist.area,
      artist.beginYear
        ? `${artist.beginYear}${artist.endYear ? `–${artist.endYear}` : ''}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Artist'
  );
}

function FollowingSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['artist-follow-search', debounced],
    queryFn: ({ signal }) => api.searchArtists(debounced, 8, signal),
    enabled: debounced.length >= 2,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const results = searchQuery.data?.results ?? [];
  const searching = debounced.length >= 2;

  return (
    <div className="mt-6">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted/70"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search an artist to follow…"
          className="input py-2.5 pr-3 pl-9 text-[13px]"
          aria-label="Search an artist to follow"
        />
      </div>
      <p className="mt-2 text-[11px] text-muted/60">
        No record or wishlist item needed. Search MusicBrainz, then follow.
      </p>

      {searching && (
        <div className="mt-3">
          {searchQuery.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                >
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-1/2" />
                    <div className="skeleton mt-2 h-2.5 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery.isError ? (
            <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2.5">
              <p className="text-xs text-red-200">
                {searchQuery.error instanceof Error
                  ? searchQuery.error.message
                  : 'Could not search artists.'}
              </p>
              <button
                type="button"
                onClick={() => searchQuery.refetch()}
                className="mt-2 text-[11px] font-medium text-accent transition hover:text-accent-soft"
              >
                Try again
              </button>
            </div>
          ) : results.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-muted">
              No artists found for “{debounced}”.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="px-1 text-[9px] font-semibold tracking-[0.18em] text-muted/50 uppercase">
                Artists
              </p>
              {results.map((artist) => (
                <div
                  key={artist.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition hover:border-white/10"
                >
                  <Link
                    to={`/artists/${artist.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                  >
                    <ArtistAvatar name={artist.name} className="h-10 w-10 text-sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-cream transition group-hover:text-accent">
                        {artist.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {artistMeta(artist)}
                      </span>
                    </span>
                  </Link>
                  <FollowArtistButton artistId={artist.id} name={artist.name} compact />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedPick({
  item,
  saved,
  wishlisted,
  onOpen,
  onAdd,
  onWishlist,
  onSave,
}: {
  item: DiscoveryItem;
  saved: boolean;
  wishlisted: boolean;
  onOpen: (item: DiscoveryItem) => void;
  onAdd: (item: DiscoveryItem) => void;
  onWishlist: (item: DiscoveryItem) => void;
  onSave: (item: DiscoveryItem) => void;
}) {
  return (
    <section className="panel relative mt-6 overflow-hidden border-accent/20 bg-accent/[0.04] p-5 sm:p-6">
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      <p className="eyebrow relative flex items-center gap-2">
        <Sparkles size={12} />
        Lead pick
      </p>
      <div className="relative mt-3 flex flex-col gap-5 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          aria-label={`Open ${item.title} by ${item.artist}`}
        >
          <CoverArt
            src={item.coverUrl}
            title={item.title}
            className="h-44 w-44 rounded-2xl sm:h-48 sm:w-48"
            iconSize={32}
          />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
            {item.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {[item.artist, item.year, item.primaryType].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 text-sm text-muted">{item.reason}</p>
          <a
            href={`https://listenbrainz.org/release-group/${item.id}/`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-cream transition hover:border-accent/50 hover:bg-accent/15"
          >
            <Headphones size={14} className="text-accent" />
            Listen on ListenBrainz
            <ExternalLink size={11} className="text-muted" />
          </a>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onWishlist(item)}
              disabled={wishlisted}
              className="btn btn-primary"
            >
              <Heart size={15} />
              {wishlisted ? 'In wishlist' : 'Add to wishlist'}
            </button>
            <button
              type="button"
              onClick={() => onSave(item)}
              disabled={saved}
              className="btn btn-secondary"
            >
              <Bookmark size={14} />
              {saved ? 'Saved' : 'Save for later'}
            </button>
            <button
              type="button"
              onClick={() => onAdd(item)}
              className="btn btn-secondary"
            >
              <Disc3 size={14} />I already own it — Add to library
            </button>
          </div>
        </div>
      </div>
    </section>
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<DiscoveryItem | null>(null);
  const viewParam = params.get('view');
  const view = viewParam === 'saved' || viewParam === 'following' ? viewParam : 'for-you';
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['discover'],
    queryFn: () => api.discover(),
    staleTime: 10 * 60_000,
  });
  const savedQuery = useQuery({
    queryKey: ['saved'],
    queryFn: api.listSavedSuggestions,
    staleTime: 30_000,
  });
  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: api.listWishlist,
    staleTime: 30_000,
  });
  const followsQuery = useQuery({
    queryKey: ['artist-follows'],
    queryFn: api.listFollowedArtists,
    staleTime: 30_000,
  });
  const savedItems = savedQuery.data?.items ?? [];
  const followedArtists = followsQuery.data?.items ?? [];
  const followedInLibrary = followedArtists.filter(
    (artist) => (artist.ownedCount ?? 0) > 0,
  ).length;
  const savedGroupIds = new Set(savedItems.map((item) => item.releaseGroupId));
  const wishlistedGroupIds = new Set(
    (wishlistQuery.data?.items ?? [])
      .map((item) => item.releaseGroupId)
      .filter((id): id is string => Boolean(id)),
  );

  function setView(next: 'for-you' | 'saved' | 'following') {
    const query = new URLSearchParams(params);
    if (next === 'for-you') query.delete('view');
    else query.set('view', next);
    setParams(query, { replace: true });
  }

  const addToWishlist = useMutation({
    mutationFn: (item: DiscoveryItem) =>
      api.createWishlistItem({
        releaseGroupId: item.id,
        title: item.title,
        artist: item.artist,
        artistId: item.artistId,
        year: item.year,
        releaseDate: item.firstReleaseDate,
        coverUrl: item.coverUrl,
        format: item.primaryType,
        formatDetail: item.primaryType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast('Added to wishlist', 'success');
    },
    onError: (mutationError) => {
      toast(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Could not add this release to your wishlist',
        'error',
      );
    },
  });

  const saveSuggestion = useMutation({
    mutationFn: (item: DiscoveryItem) =>
      api.saveSuggestion({
        releaseGroupId: item.id,
        title: item.title,
        artist: item.artist,
        artistId: item.artistId,
        year: item.year,
        releaseDate: item.firstReleaseDate,
        coverUrl: item.coverUrl,
        type: item.primaryType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast('Saved for later', 'success');
    },
    onError: (mutationError) => {
      toast(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Could not save this release',
        'error',
      );
    },
  });

  const promoteSaved = useMutation({
    mutationFn: (item: SavedSuggestion) => api.promoteSavedSuggestion(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast('Moved to wishlist', 'success');
    },
    onError: (mutationError) => {
      toast(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Could not move this release to your wishlist',
        'error',
      );
    },
  });

  const removeSaved = useMutation({
    mutationFn: (item: SavedSuggestion) => api.removeSavedSuggestion(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast('Removed from saved', 'info');
    },
    onError: (mutationError) => {
      toast(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Could not remove this release',
        'error',
      );
    },
  });

  const unfollowArtist = useMutation({
    mutationFn: (artist: FollowedArtist) => api.unfollowArtist(artist.artistId),
    onSuccess: (_result, artist) => {
      queryClient.invalidateQueries({ queryKey: ['artist-follows'] });
      toast(`Unfollowed ${artist.name}`, 'info');
    },
    onError: (mutationError) => {
      toast(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Could not unfollow this artist',
        'error',
      );
    },
  });

  const refreshDiscovery = useMutation({
    mutationFn: () => api.discover(true),
    onSuccess: (feed) => {
      queryClient.setQueryData(['discover'], feed);
    },
    onError: (mutationError) => {
      toast(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Could not refresh discovery',
        'error',
      );
    },
  });

  function wishlistItem(item: DiscoveryItem) {
    addToWishlist.mutate(item);
  }

  function saveItem(item: DiscoveryItem) {
    saveSuggestion.mutate(item);
  }

  function addGroup(item: DiscoveryItem) {
    openAdd({
      query: `rgid:${item.id}`,
      display: `${item.artist} — ${item.title}`,
    });
  }

  function openItem(item: DiscoveryItem) {
    setSelected(item);
    void api
      .recordDiscoveryEvent({
        releaseGroupId: item.id,
        artistId: item.artistId,
        artist: item.artist,
        action: 'open',
      })
      .catch(() => undefined);
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

  const empty = !data.featured && data.sections.length === 0;

  return (
    <div className="pb-24">
      <header className="mt-8">
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
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Clock size={17} />
            </span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">
                Next shelf refresh
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display text-base font-semibold text-cream">
                  {nextRefreshLabel(data.nextRefreshAt)}
                </span>
                <span className="text-[11px] text-muted">
                  {nextRefreshDate(data.nextRefreshAt)}
                </span>
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted sm:text-right">
            {updatedLabel(data.generatedAt)}
          </p>
        </div>
        <div className="mt-4 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.02] p-1">
          <button
            type="button"
            onClick={() => setView('for-you')}
            className={
              view === 'for-you'
                ? 'shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-cream'
                : 'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-cream'
            }
            aria-pressed={view === 'for-you'}
          >
            Picks
          </button>
          <button
            type="button"
            onClick={() => setView('saved')}
            className={
              view === 'saved'
                ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-cream'
                : 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-cream'
            }
            aria-pressed={view === 'saved'}
          >
            Saved
            <span
              className={
                view === 'saved'
                  ? 'rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] tabular-nums text-cream/80'
                  : 'rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-muted'
              }
            >
              {savedItems.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView('following')}
            className={
              view === 'following'
                ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-cream'
                : 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-cream'
            }
            aria-pressed={view === 'following'}
          >
            Following
            <span
              className={
                view === 'following'
                  ? 'rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] tabular-nums text-cream/80'
                  : 'rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-muted'
              }
            >
              {followedArtists.length}
            </span>
          </button>
        </div>
      </header>

      {view === 'for-you' && data.basedOn.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-[0.14em] text-muted uppercase">
            Based on
          </span>
          {data.basedOn.map((genre) => (
            <span key={genre} className="chip cursor-default">
              {genre}
            </span>
          ))}
        </div>
      )}

      {view === 'saved' ? (
        savedQuery.isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index}>
                <div className="skeleton aspect-square w-full rounded-xl" />
                <div className="skeleton mt-3 h-3 w-4/5" />
                <div className="skeleton mt-2 h-2.5 w-3/5" />
              </div>
            ))}
          </div>
        ) : savedQuery.isError ? (
          <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
            <Bookmark size={26} className="text-coral" />
            <p className="mt-3 text-sm font-medium text-cream">
              Could not load saved suggestions
            </p>
            <button
              type="button"
              onClick={() => savedQuery.refetch()}
              className="btn btn-secondary mt-4"
            >
              Try again
            </button>
          </div>
        ) : savedItems.length === 0 ? (
          <div className="panel mt-8">
            <EmptyState
              icon={<Bookmark size={20} />}
              title="Nothing saved yet"
              description="Save suggestions to listen and decide later before adding them to your wishlist."
              actionLabel="Browse suggestions"
              onAction={() => setView('for-you')}
            />
          </div>
        ) : (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-cream">
                  Saved for later
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Listen and decide before adding to your wishlist.
                </p>
              </div>
              <p className="text-[11px] text-muted">
                {pluralize(savedItems.length, 'save')}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {savedItems.map((item) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onPromote={(saved) => promoteSaved.mutate(saved)}
                  onRemove={(saved) => removeSaved.mutate(saved)}
                  busy={promoteSaved.isPending || removeSaved.isPending}
                />
              ))}
            </div>
          </section>
        )
      ) : view === 'following' ? (
        <>
          <FollowingSearch />
          {followsQuery.isLoading ? (
            <div className="mt-8 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : followsQuery.isError ? (
            <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
              <Users size={26} className="text-coral" />
              <p className="mt-3 text-sm font-medium text-cream">
                Could not load followed artists
              </p>
              <button
                type="button"
                onClick={() => followsQuery.refetch()}
                className="btn btn-secondary mt-4"
              >
                Try again
              </button>
            </div>
          ) : followedArtists.length === 0 ? (
            <div className="panel mt-8">
              <EmptyState
                icon={<Users size={20} />}
                title="No followed artists yet"
                description="Use the search above to follow any artist. No record or wishlist item needed."
              />
            </div>
          ) : (
            <section className="mt-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-cream">
                    Artists you follow
                  </h2>
                  <p className="mt-1 max-w-lg text-xs text-muted">
                    A direct taste signal for future picks. Following never saves or
                    wishlists an album.
                  </p>
                </div>
                <p className="text-[11px] text-muted">
                  {pluralize(followedArtists.length, 'artist')}
                  {followedInLibrary > 0 ? ` · ${followedInLibrary} in your library` : ''}
                </p>
              </div>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {followedArtists.map((artist) => (
                  <FollowingRow
                    key={artist.artistId}
                    artist={artist}
                    onUnfollow={(item) => unfollowArtist.mutate(item)}
                    busy={
                      unfollowArtist.isPending &&
                      unfollowArtist.variables?.artistId === artist.artistId
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : empty && data.basedOn.length === 0 ? (
        <div className="panel mt-8">
          <EmptyState
            icon={<Sparkles size={20} />}
            title="Discovery needs a few genres"
            description="Add records with genres to your library. Sleeve will use them to find new artists and albums."
            actionLabel="Add a release"
            onAction={() => openAdd()}
          />
        </div>
      ) : empty ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Compass size={28} className="text-muted/50" />
          <p className="mt-3 text-sm font-medium text-cream">
            No fresh suggestions right now
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            MusicBrainz did not return new albums for your top genres. Sleeve will try
            again automatically, or you can search now.
          </p>
          <button
            type="button"
            onClick={() => refreshDiscovery.mutate()}
            disabled={refreshDiscovery.isPending}
            className="btn btn-secondary mt-4"
          >
            {refreshDiscovery.isPending ? 'Searching…' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          {data.featured && (
            <FeaturedPick
              item={data.featured}
              saved={savedGroupIds.has(data.featured.id)}
              wishlisted={wishlistedGroupIds.has(data.featured.id)}
              onOpen={openItem}
              onAdd={addGroup}
              onWishlist={wishlistItem}
              onSave={saveItem}
            />
          )}

          {data.sections.map((section) => (
            <section key={section.id} className="mt-10">
              <div>
                <h2 className="font-display text-2xl font-semibold text-cream">
                  {section.title}
                </h2>
                <p className="mt-1 text-xs text-muted">{section.subtitle}</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {section.items.map((item) => (
                  <DiscoverCard key={item.id} item={item} onOpen={openItem} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <SuggestionDialog
        item={selected}
        saved={selected ? savedGroupIds.has(selected.id) : false}
        wishlisted={selected ? wishlistedGroupIds.has(selected.id) : false}
        onClose={() => setSelected(null)}
        onWishlist={wishlistItem}
        onSave={saveItem}
        onOwn={(item) => {
          setSelected(null);
          addGroup(item);
        }}
      />
    </div>
  );
}
