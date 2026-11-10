import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Disc3, ExternalLink, Heart, X } from 'lucide-react';
import type { DiscoveryItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { CoverArt } from './cover-art';
import { FormatBadge } from './release-card';

export function SuggestionDialog({
  item,
  saved,
  wishlisted,
  onClose,
  onWishlist,
  onSave,
  onOwn,
}: {
  item: DiscoveryItem | null;
  saved: boolean;
  wishlisted: boolean;
  onClose: () => void;
  onWishlist: (item: DiscoveryItem) => void;
  onSave: (item: DiscoveryItem) => void;
  onOwn: (item: DiscoveryItem) => void;
}) {
  useEffect(() => {
    if (!item) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 sm:max-h-[85vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label={`${item.title} suggestion`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="eyebrow">Suggestion</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-cream">
              Decide what to do with this release
            </h2>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-5 sm:flex-row">
            <CoverArt
              src={item.coverUrl}
              title={item.title}
              className="h-40 w-40 shrink-0 rounded-2xl"
              iconSize={32}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <FormatBadge format={item.primaryType} />
                {item.year && (
                  <span className="text-[10px] text-muted/60">{item.year}</span>
                )}
              </div>
              <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-cream">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {item.artistId ? (
                  <Link
                    to={`/artists/${item.artistId}`}
                    onClick={onClose}
                    className="underline-offset-4 transition hover:text-cream hover:underline"
                  >
                    {item.artist}
                  </Link>
                ) : (
                  item.artist
                )}
              </p>
              <p className="mt-1 text-xs text-muted/60">
                {[
                  item.firstReleaseDate ? formatDate(item.firstReleaseDate) : null,
                  item.releaseCount
                    ? `${item.releaseCount} ${item.releaseCount === 1 ? 'edition' : 'editions'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-3 text-xs text-muted/70">{item.reason}</p>
            </div>
          </div>

          <div className="divider my-5" />

          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => onOwn(item)}
              className="btn btn-secondary"
            >
              <Disc3 size={14} />I already own it
            </button>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted/60">
            Owning it? Choose the exact pressing and format before adding it to your
            collection.
          </p>

          <a
            href={`https://musicbrainz.org/release-group/${item.id}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[10px] text-muted transition hover:text-cream"
          >
            View on MusicBrainz
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
