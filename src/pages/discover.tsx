import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  Clock,
  Compass,
  Disc3,
  Headphones,
  Heart,
  Sparkles,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { DiscoveryItem, SavedSuggestion } from '@/lib/types';
import { pluralize } from '@/lib/utils';
import { useApp } from '@/components/app-context';
import { CoverArt } from '@/components/cover-art';
import { EmptyState } from '@/components/empty-state';
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
      className="group w-full text-left outline-none"
      aria-label={`Open ${item.title} by ${item.artist}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl transition duration-300 group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent/60">
        <CoverArt
          src={item.coverUrl}
          title={item.title}
          className="h-full w-full transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        <span className="absolute top-2 left-2 rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-accent uppercase backdrop-blur-md">
          {item.primaryType}
        </span>
        <span className="absolute right-2.5 bottom-2.5 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold text-ink-950 opacity-0 transition duration-300 group-hover:opacity-100">
          View
        </span>
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-cream" title={item.title}>
        {item.title}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted">{item.artist}</span>
        {item.year && (
          <span className="shrink-0 text-[10px] text-muted/60">{item.year}</span>
        )}
      </div>
      <p className="mt-1 line-clamp-1 text-[10px] text-muted/50">{item.reason}</p>
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
          <span className="shrink-0 text-[10px] text-muted/60">{item.year}</span>
        )}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted/50">
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
    <section className="panel mt-6 p-5 sm:p-6">
      <p className="eyebrow flex items-center gap-2">
        <Sparkles size={12} />
        Lead pick
      </p>
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="group shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          aria-label={`Open ${item.title} by ${item.artist}`}
        >
          <CoverArt
            src={item.coverUrl}
            title={item.title}
            className="h-40 w-40 rounded-2xl transition duration-500 group-hover:scale-[1.02]"
            iconSize={32}
          />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-cream">
            {item.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {[item.artist, item.year, item.primaryType].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 text-xs text-muted/70">{item.reason}</p>
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
              {saved ? 'Saved' : 'Save'}
            </button>
            <a
              href={`https://listenbrainz.org/release-group/${item.id}/`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              <Headphones size={14} />
              Listen on ListenBrainz
            </a>
            <button
              type="button"
              onClick={() => onAdd(item)}
              className="btn btn-secondary"
            >
              <Disc3 size={14} />I own it
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
  const view = params.get('view') === 'saved' ? 'saved' : 'for-you';
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
  const savedItems = savedQuery.data?.items ?? [];
  const savedGroupIds = new Set(savedItems.map((item) => item.releaseGroupId));
  const wishlistedGroupIds = new Set(
    (wishlistQuery.data?.items ?? [])
      .map((item) => item.releaseGroupId)
      .filter((id): id is string => Boolean(id)),
  );

  function setView(next: 'for-you' | 'saved') {
    const query = new URLSearchParams(params);
    if (next === 'saved') query.set('view', 'saved');
    else query.delete('view');
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
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-accent/20 bg-accent/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Clock size={17} />
            </span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-muted/70 uppercase">
                Next shelf refresh
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display text-base font-semibold text-cream">
                  {nextRefreshLabel(data.nextRefreshAt)}
                </span>
                <span className="text-[11px] text-muted/60">
                  {nextRefreshDate(data.nextRefreshAt)}
                </span>
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted/60 sm:text-right">
            {updatedLabel(data.generatedAt)}
          </p>
        </div>
        <div className="mt-4 flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
          <button
            type="button"
            onClick={() => setView('for-you')}
            className={
              view === 'for-you'
                ? 'rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-cream'
                : 'rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-cream'
            }
            aria-pressed={view === 'for-you'}
          >
            For you
          </button>
          <button
            type="button"
            onClick={() => setView('saved')}
            className={
              view === 'saved'
                ? 'rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-cream'
                : 'rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-cream'
            }
            aria-pressed={view === 'saved'}
          >
            Saved {savedItems.length}
          </button>
        </div>
      </header>

      {view === 'for-you' && data.basedOn.length > 0 && (
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
              <p className="text-[11px] text-muted/60">
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
            MusicBrainz did not return new albums for your top genres. The feed will
            refresh automatically later.
          </p>
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
              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
