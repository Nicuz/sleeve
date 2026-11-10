import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Loader2, Shuffle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { CoverArt } from './cover-art';

export function ShuffleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['random-release'],
    queryFn: api.randomRelease,
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (open) void query.refetch();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const release = query.data?.release;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/60 sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a shuffle album"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="eyebrow">Shelf shuffle</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-cream">
              Pick a shuffle album
            </h2>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {query.isLoading ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="skeleton h-40 w-40 rounded-2xl" />
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-28" />
            </div>
          ) : release ? (
            <div className="flex flex-col items-center text-center">
              <CoverArt
                src={release.coverUrl}
                title={release.title}
                className="h-40 w-40 rounded-2xl border border-white/10 shadow-xl shadow-black/30"
                iconSize={30}
              />
              <p className="mt-4 font-display text-lg font-semibold text-cream">
                {release.title}
              </p>
              <p className="mt-0.5 text-sm text-muted">{release.artist}</p>
              <p className="mt-1 text-[10px] tracking-[0.14em] text-muted/50 uppercase">
                {[release.year ?? undefined, release.format].filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              Nothing on the shelf to pick from yet.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-4">
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="btn btn-secondary py-2 text-xs"
          >
            {query.isFetching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shuffle size={14} />
            )}
            Shuffle again
          </button>
          {release ? (
            <Link
              to={`/releases/${release.id}`}
              onClick={onClose}
              className="btn btn-primary py-2 text-xs"
            >
              Open album
              <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
