import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Grid2x2, Heart, List, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type { WishlistItem } from '@/lib/types';
import { useSettings } from '@/lib/settings';
import { cn, formatPrice } from '@/lib/utils';
import { CardHalo } from '@/components/card-halo';
import { CoverArt } from '@/components/cover-art';
import { FormatBadge } from '@/components/release-card';
import { EmptyState } from '@/components/empty-state';
import { WishlistAddDialog } from '@/components/wishlist-add-dialog';
import { WishlistEditDialog } from '@/components/wishlist-edit-dialog';

function WishlistCard({
  item,
  onEdit,
}: {
  item: WishlistItem;
  onEdit: (item: WishlistItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="group relative w-full text-left outline-none"
    >
      <CardHalo />
      <div className="relative aspect-square overflow-hidden rounded-xl group-focus-visible:ring-2 group-focus-visible:ring-accent/60">
        <CoverArt src={item.coverUrl} title={item.title} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        <FormatBadge format={item.format} overlay className="absolute top-2 left-2" />
        <span className="absolute right-2.5 bottom-2.5 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold text-ink-950 opacity-0   transition duration-300 group-hover:opacity-100">
          Edit
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-sm font-semibold text-cream" title={item.title}>
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted" title={item.artist}>
          {item.artist}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted/60">
          <span className="truncate">
            {[
              item.year ?? undefined,
              item.format,
              item.targetPrice !== null ? undefined : 'no target',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {item.targetPrice !== null && (
            <span className="shrink-0 text-right">
              <span className="text-muted/50">Target </span>
              <span className="font-medium text-accent/90">
                {formatPrice(item.targetPrice, item.targetCurrency)}
              </span>
            </span>
          )}
        </div>
        {item.notes && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted/50">
            {item.notes}
          </p>
        )}
      </div>
    </button>
  );
}

function WishlistRow({
  item,
  onEdit,
}: {
  item: WishlistItem;
  onEdit: (item: WishlistItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/[0.04] sm:gap-4 sm:px-3"
    >
      <CoverArt
        src={item.coverUrl}
        title={item.title}
        className="h-12 w-12 shrink-0 rounded-lg"
        iconSize={20}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cream">{item.title}</p>
        <p className="truncate text-xs text-muted">{item.artist}</p>
      </div>
      <div className="hidden w-16 shrink-0 text-xs text-muted md:block">
        {item.year ?? '—'}
      </div>
      <div className="hidden w-24 shrink-0 md:block">
        <FormatBadge format={item.format} />
      </div>
      <div className="w-24 shrink-0 text-right text-[11px]">
        {item.targetPrice !== null ? (
          <>
            <span className="text-muted/50">Target </span>
            <span className="font-medium text-accent/90">
              {formatPrice(item.targetPrice, item.targetCurrency)}
            </span>
          </>
        ) : (
          <span className="text-muted/40">—</span>
        )}
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-muted"
      />
    </button>
  );
}

function WishlistSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index}>
          <div className="skeleton aspect-square w-full rounded-xl" />
          <div className="skeleton mt-3 h-3 w-4/5" />
          <div className="skeleton mt-2 h-2.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function WishlistPage() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<WishlistItem | null>(null);
  const [sort, setSort] = useState<'recent' | 'artist' | 'price'>('recent');
  const focusId = params.get('item');
  const openedFocusRef = useRef<string | null>(null);
  const viewParam = params.get('view');
  const view =
    viewParam === 'list' || viewParam === 'grid' ? viewParam : settings.defaultView;

  function setView(next: 'grid' | 'list') {
    const query = new URLSearchParams(params);
    if (next === settings.defaultView) query.delete('view');
    else query.set('view', next);
    setParams(query, { replace: true });
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wishlist'],
    queryFn: api.listWishlist,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  useEffect(() => {
    if (!focusId || !data) return;
    if (openedFocusRef.current === focusId) return;
    const item = data.items.find((entry) => entry.id === focusId);
    if (!item) return;
    openedFocusRef.current = focusId;
    setEditing(item);
    const next = new URLSearchParams(params);
    next.delete('item');
    setParams(next, { replace: true });
  }, [data, focusId, params, setParams]);
  const targetTotals = new Map<string, number>();
  for (const item of items) {
    if (item.targetPrice === null) continue;
    const currency = item.targetCurrency ?? 'EUR';
    targetTotals.set(currency, (targetTotals.get(currency) ?? 0) + item.targetPrice);
  }
  const targetEntries = [...targetTotals.entries()];
  const targetValue =
    targetEntries.length === 1
      ? formatPrice(targetEntries[0][1], targetEntries[0][0])
      : targetEntries.length > 1
        ? `${targetEntries.length} currencies`
        : null;
  const sortedItems = [...items].sort((a, b) => {
    if (sort === 'artist') {
      return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
    }
    if (sort === 'price') {
      return (
        (a.targetPrice ?? Number.POSITIVE_INFINITY) -
          (b.targetPrice ?? Number.POSITIVE_INFINITY) || a.title.localeCompare(b.title)
      );
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
  const existingIds = new Set(
    items.map((item) => item.musicbrainzId).filter((id): id is string => Boolean(id)),
  );

  return (
    <div className="pb-24">
      <header className="mt-8">
        <p className="eyebrow flex items-center gap-2">
          <Heart size={12} />
          Wishlist
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
          Records to hunt down.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Keep the pressings you want in sight, set target prices and decide what deserves
          the next trip to the shop.
        </p>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn btn-primary mt-5"
        >
          <Plus size={16} />
          Add to wishlist
        </button>

        <div className="mt-8 flex flex-wrap gap-8 sm:gap-12">
          <div>
            <p className="font-display text-2xl font-semibold text-cream/90 tabular-nums">
              {items.length}
            </p>
            <p className="mt-0.5 text-[10px] tracking-[0.18em] text-muted/60 uppercase">
              Wants
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-cream/90 tabular-nums">
              {targetValue ?? '—'}
            </p>
            <p className="mt-0.5 text-[10px] tracking-[0.18em] text-muted/60 uppercase">
              Target
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <WishlistSkeleton />
      ) : isError ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Heart size={28} className="text-coral" />
          <p className="mt-3 text-sm font-medium text-cream">
            Could not load your wishlist
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
      ) : items.length === 0 ? (
        <div className="panel mt-8">
          <EmptyState
            icon={<Heart size={20} />}
            title="Nothing on the hunt list"
            description="Search MusicBrainz and add the pressings you want. Set target prices whenever you like."
            actionLabel="Add your first want"
            onAction={() => setAddOpen(true)}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as 'recent' | 'artist' | 'price')
                  }
                  className="select w-40 pr-8 text-xs"
                  aria-label="Sort wishlist"
                >
                  <option value="recent">Recently added</option>
                  <option value="artist">Artist A–Z</option>
                  <option value="price">Target price</option>
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full transition',
                  view === 'grid'
                    ? 'bg-white/10 text-cream'
                    : 'text-muted hover:text-cream',
                )}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
              >
                <Grid2x2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full transition',
                  view === 'list'
                    ? 'bg-white/10 text-cream'
                    : 'text-muted hover:text-cream',
                )}
                aria-label="List view"
                aria-pressed={view === 'list'}
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {view === 'list' ? (
            <div className="panel mt-4 divide-y divide-white/[0.04] p-1.5">
              {sortedItems.map((item) => (
                <WishlistRow key={item.id} item={item} onEdit={setEditing} />
              ))}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sortedItems.map((item) => (
                <WishlistCard key={item.id} item={item} onEdit={setEditing} />
              ))}
            </div>
          )}
        </>
      )}

      <WishlistAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingIds={existingIds}
      />
      <WishlistEditDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
