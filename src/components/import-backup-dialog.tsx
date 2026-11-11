import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileJson, Loader2, Upload, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { ImportMode, ImportPreview, ImportResult } from '@/lib/types';
import { cn, formatDate, pluralize } from '@/lib/utils';
import { useToast } from './toast';

export function ImportBackupDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: (result: ImportResult) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirmation, setConfirmation] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setFileName(null);
    setPayload(null);
    setPreview(null);
    setMode('merge');
    setConfirmation('');
    setLoadingPreview(false);
    setImporting(false);
    setError(null);
  }, [open]);

  async function loadPreview(data: unknown, nextMode: ImportMode) {
    setLoadingPreview(true);
    setError(null);
    try {
      const result = await api.previewImport(data, nextMode);
      setPreview(result);
      if (nextMode === 'replace' && !result.canReplace) {
        setMode('merge');
        await loadPreview(data, 'merge');
      }
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Could not read this backup.',
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setMode('merge');
    setConfirmation('');
    setPreview(null);
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      setPayload(parsed);
      await loadPreview(parsed, 'merge');
    } catch (fileError) {
      setPayload(null);
      setError(
        fileError instanceof SyntaxError
          ? 'That file is not a valid backup file.'
          : fileError instanceof Error
            ? fileError.message
            : 'Could not read this file.',
      );
    }
  }

  function chooseMode(nextMode: ImportMode) {
    if (!payload || nextMode === mode) return;
    setMode(nextMode);
    setConfirmation('');
    void loadPreview(payload, nextMode);
  }

  async function runImport() {
    if (!payload || !preview) return;
    if (mode === 'replace' && confirmation.trim().toUpperCase() !== 'RESTORE') {
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const result = await api.importData(payload, mode);
      queryClient.invalidateQueries();
      queryClient.removeQueries({ queryKey: ['release'] });
      toast(
        mode === 'replace'
          ? 'Library replaced from backup'
          : 'Backup added to your library',
        'success',
      );
      toast('A safety copy was saved before restoring.', 'info');
      onImported?.(result);
      onClose();
    } catch (importError) {
      setError(
        importError instanceof ApiError
          ? importError.message
          : importError instanceof Error
            ? importError.message
            : 'Could not restore the backup.',
      );
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const importableTotal = preview
    ? preview.importable.releases +
      preview.importable.wishlist +
      preview.importable.saved +
      preview.importable.follows +
      (preview.importable.hasSettings ? 1 : 0)
    : 0;
  const duplicateTotal = preview
    ? preview.duplicates.releases +
      preview.duplicates.wishlist +
      preview.duplicates.saved +
      preview.duplicates.follows
    : 0;
  const invalidTotal = preview
    ? preview.invalid.releases +
      preview.invalid.wishlist +
      preview.invalid.saved +
      preview.invalid.follows +
      preview.invalid.settings
    : 0;
  const incomingSummary = preview
    ? [
        preview.incoming.releases
          ? pluralize(preview.incoming.releases, 'release')
          : null,
        preview.incoming.tracks ? pluralize(preview.incoming.tracks, 'track') : null,
        preview.incoming.wishlist
          ? pluralize(preview.incoming.wishlist, 'wishlist item')
          : null,
        preview.incoming.saved ? pluralize(preview.incoming.saved, 'saved item') : null,
        preview.incoming.follows
          ? pluralize(preview.incoming.follows, 'followed artist')
          : null,
        preview.incoming.hasSettings ? 'library defaults' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const canImport = Boolean(preview && importableTotal > 0 && !loadingPreview);
  const replaceBlocked = !preview?.canReplace;
  const replaceConfirmed =
    mode !== 'replace' || confirmation.trim().toUpperCase() === 'RESTORE';

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
        aria-label="Restore backup"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="eyebrow">Backup</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-cream">
              Restore backup
            </h2>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
              <FileJson size={20} />
            </span>
            <p className="mt-3 truncate text-sm font-medium text-cream">
              {fileName ?? 'Choose a Sleeve backup file'}
            </p>
            <p className="mt-1 text-xs text-muted">
              A backup file contains releases, wishlist, saved items, followed artists and
              defaults.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary mt-4 py-2 text-xs"
              disabled={importing}
            >
              <Upload size={13} />
              Choose backup file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
          </div>

          {loadingPreview && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-xs text-muted">
              <Loader2 size={14} className="animate-spin" />
              Reading backup…
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {preview && !loadingPreview && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-muted">
                  {preview.source.app === 'sleeve'
                    ? `Sleeve backup${
                        preview.source.exportedAt
                          ? ` · exported ${formatDate(preview.source.exportedAt)}`
                          : ''
                      }`
                    : 'This file is not a full Sleeve backup.'}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-cream">
                  {incomingSummary
                    ? `This backup contains ${incomingSummary}.`
                    : 'This backup is empty.'}
                </p>
                {duplicateTotal > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    {pluralize(duplicateTotal, 'item')} already in your library will be
                    skipped.
                  </p>
                )}
                {invalidTotal > 0 && (
                  <p className="mt-1 text-xs text-amber-200/80">
                    {pluralize(invalidTotal, 'item')} cannot be read and will be skipped.
                  </p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseMode('merge')}
                  aria-pressed={mode === 'merge'}
                  className={cn(
                    'rounded-2xl border p-3 text-left transition',
                    mode === 'merge'
                      ? 'border-accent/40 bg-accent/[0.06]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20',
                  )}
                >
                  <span className="text-sm font-semibold text-cream">
                    Add to my library
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                    Keeps your current collection. Skips items already there.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => chooseMode('replace')}
                  disabled={replaceBlocked}
                  aria-pressed={mode === 'replace'}
                  className={cn(
                    'rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                    mode === 'replace'
                      ? 'border-red-400/30 bg-red-500/[0.08]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20',
                  )}
                >
                  <span className="text-sm font-semibold text-cream">
                    Replace my library
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                    Removes your current collection, then restores this backup.
                  </span>
                </button>
              </div>

              {replaceBlocked && (
                <p className="text-[11px] text-muted">
                  This file is not a full backup. You can add its releases, but cannot
                  replace your collection.
                </p>
              )}

              {mode === 'replace' && (
                <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-3">
                  <p className="text-xs font-medium text-red-200">
                    This will remove your current{' '}
                    {pluralize(preview.current.releases, 'release')} and restore{' '}
                    {pluralize(preview.importable.releases, 'release')}.
                  </p>
                  {!preview.incoming.hasSettings && (
                    <p className="mt-1 text-[11px] text-red-200/80">
                      Library defaults will reset to built-in values.
                    </p>
                  )}
                  <label className="mt-2 block">
                    <span className="field-label">Type RESTORE to confirm</span>
                    <input
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      className="input mt-1"
                      placeholder="RESTORE"
                      autoComplete="off"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void runImport()}
            disabled={!canImport || !replaceConfirmed || importing || loadingPreview}
            className={cn('btn', mode === 'replace' ? 'btn-danger' : 'btn-primary')}
          >
            {importing && <Loader2 size={14} className="animate-spin" />}
            {mode === 'replace'
              ? 'Replace library'
              : importableTotal > 0
                ? 'Add to my library'
                : 'Nothing new to add'}
          </button>
        </div>
      </div>
    </div>
  );
}
