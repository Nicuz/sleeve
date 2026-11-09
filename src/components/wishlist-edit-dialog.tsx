import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { WishlistItem } from '@/lib/types';
import {
  cn,
  CURRENCIES,
  parsePriceInput,
  PRIORITIES,
} from '@/lib/utils';
import { CoverArt } from './cover-art';
import { useToast } from './toast';

const priorityStyles: Record<number, string> = {
  1: 'border-white/10 bg-white/[0.03] text-muted',
  2: 'border-accent/30 bg-accent/10 text-accent',
  3: 'border-coral/30 bg-coral/10 text-coral',
};

export function WishlistEditDialog({
  item,
  onClose,
}: {
  item: WishlistItem | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetPrice, setTargetPrice] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const [priority, setPriority] = useState(2);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTargetPrice(
      item.targetPrice !== null ? String(item.targetPrice) : '',
    );
    setTargetCurrency(item.targetCurrency ?? 'EUR');
    setPriority(item.priority);
    setNotes(item.notes ?? '');
    setConfirmDelete(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;
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
  }, [item, onClose]);

  const updateItem = useMutation({
    mutationFn: () => {
      if (!item) throw new Error('No wishlist item selected');
      const price = parsePriceInput(targetPrice);
      return api.updateWishlistItem(item.id, {
        targetPrice: price,
        targetCurrency: price === null ? null : targetCurrency,
        priority,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast('Wishlist item updated', 'success');
      onClose();
    },
    onError: (error) => {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not update wishlist item',
        'error',
      );
    },
  });

  const deleteItem = useMutation({
    mutationFn: () => {
      if (!item) throw new Error('No wishlist item selected');
      return api.deleteWishlistItem(item.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast('Removed from wishlist', 'info');
      onClose();
    },
    onError: (error) => {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not remove wishlist item',
        'error',
      );
    },
  });

  if (!item) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/60 sm:max-h-[85vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Edit wishlist item"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">
              Wishlist details
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Target, priority and private notes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex gap-4">
            <CoverArt
              src={item.coverUrl}
              title={item.title}
              className="h-24 w-24 shrink-0 rounded-xl border border-white/10"
              iconSize={24}
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate font-display text-base font-semibold text-cream">
                {item.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {item.artist}
              </p>
              <p className="mt-1.5 text-[10px] text-muted/60">
                {[item.year ?? undefined, item.format, item.label ?? undefined]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.musicbrainzId && (
                <a
                  href={`https://musicbrainz.org/release/${item.musicbrainzId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted transition hover:text-cream"
                >
                  MusicBrainz
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          <div className="divider my-5" />

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">Target price</span>
              <input
                type="text"
                inputMode="decimal"
                value={targetPrice}
                onChange={(event) => setTargetPrice(event.target.value)}
                className="input"
                placeholder="15,00 (optional)"
              />
            </label>
            <label>
              <span className="field-label">Currency</span>
              <select
                value={targetCurrency}
                onChange={(event) => setTargetCurrency(event.target.value)}
                className="input"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <span className="field-label">Priority</span>
              <div className="grid grid-cols-3 gap-1.5">
                {PRIORITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPriority(option.value)}
                    className={cn(
                      'rounded-xl border py-2 text-xs font-medium transition',
                      priority === option.value
                        ? priorityStyles[option.value]
                        : 'border-white/10 bg-white/[0.02] text-muted hover:text-cream',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="sm:col-span-2">
              <span className="field-label">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input min-h-24 resize-y"
                placeholder="Pressing to look for, shop, condition, max price…"
              />
            </label>
          </div>

          {confirmDelete && (
            <div className="animate-fade-in mt-4 rounded-xl border border-red-400/20 bg-red-500/[0.07] p-3.5">
              <p className="text-xs font-medium text-red-200">
                Remove “{item.title}” from the wishlist?
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => deleteItem.mutate()}
                  disabled={deleteItem.isPending}
                  className="btn btn-danger py-1.5 text-xs"
                >
                  {deleteItem.isPending && (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn btn-ghost py-1.5 text-xs"
                >
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={confirmDelete}
            className="btn btn-ghost px-2 text-xs text-muted hover:text-red-300 disabled:opacity-40"
          >
            <Trash2 size={14} />
            Remove
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost py-2">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => updateItem.mutate()}
              disabled={updateItem.isPending}
              className="btn btn-primary py-2"
            >
              {updateItem.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
