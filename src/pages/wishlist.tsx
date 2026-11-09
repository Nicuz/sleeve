import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Heart, Plus, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import type { WishlistItem } from '@/lib/types';
import { cn, formatPrice, pluralize, PRIORITIES } from '@/lib/utils';
import { CoverArt } from '@/components/cover-art';
import { FormatBadge } from '@/components/release-card';
import { EmptyState } from '@/components/empty-state';
import { WishlistAddDialog } from '@/components/wishlist-add-dialog';
import { WishlistEditDialog } from '@/components/wishlist-edit-dialog';

const priorityBadge: Record<number, string> = {
  1: 'border-white/10 bg-black/45 text-muted',
  2: 'border-accent/30 bg-accent/15 text-accent',
  3: 'border-coral/30 bg-coral/15 text-coral',
};

function WishlistStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.07] bg-white/[0.03] text-accent">
          <Icon size={16} />
        </span>
        <span className="text-[9px] tracking-[0.14em] text-muted/40 uppercase">
          {hint}
        </span>
      </div>
      <p className="mt-4 truncate font-display text-2xl font-semibold tabular-nums text-cream">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function WishlistCard({
  item,
  onEdit,
}: {
  item: WishlistItem;
  onEdit: (item: WishlistItem) => void;
}) {
  const priority =
    PRIORITIES.find((option) => option.value === item.priority) ??
    PRIORITIES[1];
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="group w-full text-left outline-none"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-black/40 transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl group-focus-visible:ring-2 group-focus-visible:ring-accent/60">
        <CoverArt
          src={item.coverUrl}
          title={item.title}
          className="h-full w-full transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        <FormatBadge format={item.format} className="absolute top-2 left-2" />
        <span
          className={cn(
            'absolute top-2 right-2 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] uppercase backdrop-blur-md',
            priorityBadge[item.priority] ?? priorityBadge[2],
          )}
        >
          {priority.label}
        </span>
        <span className="absolute right-2.5 bottom-2.5 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold text-ink-950 opacity-0 shadow-lg shadow-black/40 transition duration-300 group-hover:opacity-100">
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
            <span className="shrink-0 font-medium text-accent/90">
              {formatPrice(item.targetPrice, item.targetCurrency)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function WishlistSkeleton() {
  return (
    <div className="mt-8">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="panel p-5">
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="skeleton mt-4 h-7 w-24" />
            <div className="skeleton mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index}>
            <div className="skeleton aspect-square w-full rounded-xl" />
            <div className="skeleton mt-3 h-3 w-4/5" />
            <div className="skeleton mt-2 h-2.5 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WishlistPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<WishlistItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wishlist'],
    queryFn: api.listWishlist,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const highPriority = items.filter((item) => item.priority === 3).length;
  const targetTotals = new Map<string, number>();
  for (const item of items) {
    if (item.targetPrice === null) continue;
    const currency = item.targetCurrency ?? 'EUR';
    targetTotals.set(
      currency,
      (targetTotals.get(currency) ?? 0) + item.targetPrice,
    );
  }
  const targetValue =
    targetTotals.size > 0
      ? [...targetTotals.entries()]
          .map(([currency, total]) => formatPrice(total, currency))
          .join(' · ')
      : '—';
  const existingIds = new Set(
    items
      .map((item) => item.musicbrainzId)
      .filter((id): id is string => Boolean(id)),
  );

  return (
    <div className="pb-24">
      <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Heart size={12} />
            Wishlist
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
            Records to hunt down.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            Keep the pressings you want in sight, set target prices and decide
            what deserves the next trip to the shop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn btn-primary self-start sm:self-auto"
        >
          <Plus size={16} />
          Add to wishlist
        </button>
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
            description="Search MusicBrainz and add the pressings you want. Set target prices and priorities whenever you like."
            actionLabel="Add your first want"
            onAction={() => setAddOpen(true)}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <WishlistStat
              icon={Heart}
              label="Records wanted"
              value={String(items.length)}
              hint="Wanted"
            />
            <WishlistStat
              icon={Flame}
              label="High priority"
              value={String(highPriority)}
              hint="Priority"
            />
            <WishlistStat
              icon={Wallet}
              label="Target budget"
              value={targetValue}
              hint="Budget"
            />
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <p className="text-xs text-muted">
              {pluralize(items.length, 'record')} on the list
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-[11px] font-medium text-accent transition hover:text-accent-soft"
            >
              Add another
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                onEdit={setEditing}
              />
            ))}
          </div>
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
