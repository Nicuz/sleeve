import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import type { Release } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { CardHalo } from './card-halo';
import { CoverArt } from './cover-art';

const formatStyles: Record<string, string> = {
  CD: 'border-accent/30 bg-accent/15 text-accent',
  Vinyl: 'border-coral/30 bg-coral/15 text-coral',
  Cassette: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  Digital: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
  Other: 'border-white/15 bg-black/40 text-cream/80',
};

export function FormatBadge({
  format,
  className,
  overlay = false,
}: {
  format: string;
  className?: string;
  overlay?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase backdrop-blur-md',
        overlay
          ? 'border-white/15 bg-black/60 px-2.5 py-1 text-[10px] text-white'
          : (formatStyles[format] ?? formatStyles.Other),
        className,
      )}
    >
      {format}
    </span>
  );
}

export function Rating({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-accent/80">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={10}
          className={index < value ? 'fill-current' : 'text-white/15'}
        />
      ))}
    </span>
  );
}

export function ReleaseCard({
  release,
  onOpen,
}: {
  release: Release;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="group relative w-full text-left">
      <CardHalo />
      <button
        type="button"
        onClick={() => onOpen(release.id)}
        className="group relative block w-full text-left outline-none"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl group-focus-visible:ring-2 group-focus-visible:ring-accent/60">
          <CoverArt
            src={release.coverUrl}
            title={release.title}
            className="h-full w-full"
          />
          <FormatBadge
            format={release.format}
            overlay
            className="absolute top-2 left-2"
          />
        </div>
        <span
          className="mt-3 block truncate text-sm font-semibold text-cream"
          title={release.title}
        >
          {release.title}
        </span>
      </button>
      {release.artistId ? (
        <Link
          to={`/artists/${release.artistId}`}
          className="mt-0.5 block truncate text-xs text-muted transition hover:text-cream"
          title={release.artist}
        >
          {release.artist}
        </Link>
      ) : (
        <p className="mt-0.5 truncate text-xs text-muted" title={release.artist}>
          {release.artist}
        </p>
      )}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] tracking-wide text-muted/60">
        {release.year && <span>{release.year}</span>}
        {release.year && <span>·</span>}
        <span>{release.trackCount ?? 0} tracks</span>
      </div>
    </div>
  );
}

export function ReleaseRow({
  release,
  onOpen,
}: {
  release: Release;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(release.id)}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/[0.04] sm:gap-4 sm:px-3"
    >
      <CoverArt
        src={release.coverUrl}
        title={release.title}
        className="h-12 w-12 shrink-0 rounded-lg"
        iconSize={20}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cream">{release.title}</p>
        <p className="truncate text-xs text-muted">{release.artist}</p>
      </div>
      <div className="hidden w-20 shrink-0 text-xs text-muted md:block">
        {release.year ?? '—'}
      </div>
      <div className="hidden w-24 shrink-0 md:block">
        <FormatBadge format={release.format} />
      </div>
      <div className="hidden w-20 shrink-0 md:block">
        <Rating value={release.rating} />
      </div>
      <div className="hidden w-28 shrink-0 text-right text-[11px] text-muted/60 lg:block">
        {formatDate(release.createdAt)}
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-muted"
      />
    </button>
  );
}
