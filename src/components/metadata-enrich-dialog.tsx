import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Loader2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { pluralize } from '@/lib/utils';
import { useToast } from './toast';

type Counts = {
  done: number;
  matched: number;
  unmatched: number;
  duplicate: number;
  failed: number;
};

const emptyCounts: Counts = {
  done: 0,
  matched: 0,
  unmatched: 0,
  duplicate: 0,
  failed: 0,
};

export function MetadataEnrichDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const cancelled = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['enrich-candidates'],
    queryFn: () => api.listReleases({}),
    enabled: open,
    staleTime: 0,
  });

  const items = (data?.releases ?? []).filter(
    (release) =>
      !release.musicbrainzId ||
      !release.coverUrl ||
      !release.trackCount,
  );

  useEffect(() => {
    if (!open) return;
    setRunning(false);
    setDone(false);
    setCurrent(null);
    setCounts(emptyCounts);
    cancelled.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  async function start() {
    if (running || items.length === 0) return;
    setRunning(true);
    setDone(false);
    setCounts(emptyCounts);
    cancelled.current = false;

    let matched = 0;
    let unmatched = 0;
    let duplicate = 0;
    let failed = 0;

    for (let index = 0; index < items.length; index += 1) {
      if (cancelled.current) break;
      const item = items[index];
      setCurrent(item.title);
      try {
        const result = await api.enrichRelease(item.id);
        if (result.status === 'matched') matched += 1;
        else if (result.status === 'unmatched') unmatched += 1;
        else duplicate += 1;
      } catch {
        failed += 1;
      }
      setCounts({
        done: index + 1,
        matched,
        unmatched,
        duplicate,
        failed,
      });
    }

    setCurrent(null);
    setRunning(false);
    setDone(true);
    queryClient.invalidateQueries({ queryKey: ['releases'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['meta'] });
    queryClient.invalidateQueries({ queryKey: ['discover'] });
    toast(
      `${pluralize(matched, 'release')} enriched from MusicBrainz`,
      matched > 0 ? 'success' : 'info',
    );
  }

  if (!open) return null;

  const total = items.length;
  const progress = total ? Math.round((counts.done / total) * 100) : 0;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !running) onClose();
      }}
    >
      <div
        className="animate-scale-in flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/60 sm:max-h-[85vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Download metadata"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">
              Download metadata
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Match missing records with MusicBrainz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="icon-btn disabled:opacity-40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton mt-4 h-20 w-full rounded-xl" />
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
                <CheckCircle2 size={22} />
              </span>
              <p className="mt-4 text-sm font-medium text-cream">
                Metadata looks complete
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted">
                Every release already has a MusicBrainz ID, cover art and a
                tracklist.
              </p>
            </div>
          ) : done ? (
            <div>
              <div className="flex flex-col items-center px-4 pt-4 pb-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-4 text-sm font-medium text-cream">
                  Download complete
                </p>
                <p className="mt-1 text-xs text-muted">
                  {pluralize(counts.matched, 'release')} matched.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="font-display text-lg text-cream">
                    {counts.matched}
                  </p>
                  <p className="text-[9px] tracking-[0.12em] text-muted/60 uppercase">
                    Matched
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="font-display text-lg text-cream">
                    {counts.unmatched}
                  </p>
                  <p className="text-[9px] tracking-[0.12em] text-muted/60 uppercase">
                    No match
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="font-display text-lg text-cream">
                    {counts.duplicate}
                  </p>
                  <p className="text-[9px] tracking-[0.12em] text-muted/60 uppercase">
                    Duplicate
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="font-display text-lg text-cream">
                    {counts.failed}
                  </p>
                  <p className="text-[9px] tracking-[0.12em] text-muted/60 uppercase">
                    Failed
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-4">
                <div className="flex items-start gap-3">
                  <CloudDownload
                    size={18}
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  <div>
                    <p className="text-sm font-medium text-cream">
                      {pluralize(total, 'record')} missing metadata
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      Sleeve searches MusicBrainz by barcode, title and artist.
                      Confident matches get cover art, tracklist and IDs. Notes,
                      ratings, condition and purchase data are preserved.
                    </p>
                  </div>
                </div>
              </div>

              {running && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="truncate">
                      {current ? `Matching “${current}”…` : 'Finding matches…'}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {counts.done}/{total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted/60">
                    <Loader2 size={11} className="animate-spin" />
                    This can take a while due to MusicBrainz rate limits.
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[10px] text-muted">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-accent/70" />
                Matches with low confidence are skipped. You can still fetch a
                single release manually from its page.
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
          {running ? (
            <button
              type="button"
              onClick={() => {
                cancelled.current = true;
              }}
              className="btn btn-ghost py-2 text-xs"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost py-2 text-xs"
            >
              Close
            </button>
          )}
          {done ? (
            <button type="button" onClick={onClose} className="btn btn-primary py-2">
              Done
            </button>
          ) : total > 0 && !isLoading ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={running}
              className="btn btn-primary py-2"
            >
              {running ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CloudDownload size={14} />
              )}
              {running ? 'Downloading…' : `Download for ${total}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
