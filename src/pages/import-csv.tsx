import { useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Table2,
  Upload,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  autoMapDiscogsColumns,
  DISCOGS_FIELDS,
  transformDiscogsRows,
  type DiscogsFieldKey,
  type DiscogsMapping,
} from '@/lib/discogs';
import { useSettings } from '@/lib/settings';
import type { ImportResult, ReleasePayload } from '@/lib/types';
import { formatPrice, pluralize } from '@/lib/utils';
import { useToast } from '@/components/toast';

export function ImportCsvPage() {
  const location = useLocation();
  const fromState = (location.state as { from?: unknown } | null)?.from;
  const from =
    typeof fromState === 'string' && fromState.startsWith('/') ? fromState : '/';
  const backLabel = from.startsWith('/settings') ? 'Back to settings' : 'Back to library';
  const { settings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<DiscogsMapping>({});
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const transformed = useMemo(
    () => transformDiscogsRows(rows, mapping, settings.defaultCurrency),
    [rows, mapping, settings.defaultCurrency],
  );

  const ready = Boolean(
    fileName &&
      headers.length &&
      mapping.title &&
      mapping.artist &&
      transformed.releases.length > 0,
  );

  const importMutation = useMutation({
    mutationFn: (releases: ReleasePayload[]) => api.importData({ releases }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries();
      toast(
        `Imported ${pluralize(data.importedReleases, 'release')} from CSV`,
        data.importedReleases > 0 ? 'success' : 'info',
      );
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not import the CSV',
        'error',
      );
    },
  });

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setResult(null);
    try {
      if (!/\.csv$/i.test(file.name)) {
        throw new Error('Choose a .csv file exported from Discogs.');
      }
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      });
      const fields = (parsed.meta.fields ?? []).filter(Boolean);
      if (fields.length === 0) {
        throw new Error('No columns found in this CSV.');
      }
      if (parsed.data.length === 0) {
        throw new Error('No rows found in this CSV.');
      }
      if (parsed.data.length > 10_000) {
        throw new Error('This CSV has too many rows. Maximum is 10,000.');
      }
      setFileName(file.name);
      setHeaders(fields);
      setRows(parsed.data);
      setMapping(autoMapDiscogsColumns(fields));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Could not read the CSV.');
      setFileName(null);
      setHeaders([]);
      setRows([]);
      setMapping({});
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function setMappedColumn(key: DiscogsFieldKey, column: string) {
    setMapping((current) => {
      const next = { ...current };
      if (column) next[key] = column;
      else delete next[key];
      return next;
    });
  }

  function reset() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="pb-24">
      <Link
        to={from}
        className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-muted transition hover:text-cream"
      >
        <ArrowLeft size={14} />
        {backLabel}
      </Link>

      <header className="mt-4">
        <p className="eyebrow flex items-center gap-2">
          <Table2 size={12} />
          Import · Discogs
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
          Bring your shelf over.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Choose a Discogs collection CSV, check the detected columns and map them to
          Sleeve. You can review the first rows before importing.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {!fileName ? (
        <div className="panel mt-8 p-6 sm:p-10">
          <div
            className="flex flex-col items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.015] px-6 py-16 text-center transition hover:border-accent/40 hover:bg-accent/[0.025]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border border-accent/20 bg-accent/10 text-accent">
              {parsing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Upload size={24} />
              )}
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-cream">
              Choose a Discogs CSV
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              In Discogs open Collection → Export, download the CSV, then drop it here.
              Columns are detected automatically.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
              className="btn btn-primary mt-6"
            >
              <FileSpreadsheet size={15} />
              Choose CSV
            </button>
          </div>
          {parseError && (
            <p className="mt-4 flex items-center gap-2 text-xs text-red-300">
              <AlertTriangle size={13} />
              {parseError}
            </p>
          )}
        </div>
      ) : result ? (
        <section className="panel mt-8 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <CheckCircle2 size={21} />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-cream">
                Import complete
              </h2>
              <p className="mt-1 text-sm text-muted">
                {pluralize(result.importedReleases, 'release')} added,{' '}
                {pluralize(result.skippedReleases, 'duplicate')} skipped,{' '}
                {pluralize(result.invalidReleases, 'invalid row')}.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/" className="btn btn-primary">
              Open library
            </Link>
            <button type="button" onClick={reset} className="btn btn-secondary">
              Import another CSV
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <FileSpreadsheet size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cream">{fileName}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {pluralize(rows.length, 'row')} · {pluralize(headers.length, 'column')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary py-2 text-xs"
              >
                Change file
              </button>
              <button
                type="button"
                onClick={reset}
                className="btn btn-ghost py-2 text-xs"
              >
                Reset
              </button>
            </div>
          </section>

          {parseError && (
            <p className="mt-3 flex items-center gap-2 text-xs text-red-300">
              <AlertTriangle size={13} />
              {parseError}
            </p>
          )}

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="panel p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-cream">
                    Map columns
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Detected {pluralize(headers.length, 'column')}. Adjust the automatic
                    mapping if needed.
                  </p>
                </div>
                <span className="chip cursor-default">
                  {Object.keys(mapping).length} mapped
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {DISCOGS_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-cream">
                        {field.label}
                        {field.required && <span className="ml-1 text-coral">*</span>}
                      </span>
                      {mapping[field.key] && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-relaxed text-muted/60">
                      {field.hint}
                    </span>
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={(event) => setMappedColumn(field.key, event.target.value)}
                      className="input mt-2 py-2 text-[11px]"
                      aria-label={`Map ${field.label}`}
                    >
                      <option value="">Not mapped</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {(!mapping.title || !mapping.artist) && (
                <p className="mt-4 flex items-center gap-2 rounded-lg border border-coral/20 bg-coral/[0.06] px-3 py-2 text-[10px] text-coral">
                  <AlertTriangle size={12} />
                  Map both Title and Artist to continue.
                </p>
              )}
            </div>

            <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <section className="panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-cream">
                      Live preview
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Updates as you adjust the mapping.
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                    </span>
                    {transformed.releases.length} ready
                  </span>
                </div>

                {transformed.releases.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-16 text-center">
                    <Table2 size={22} className="text-muted/40" />
                    <p className="mt-3 text-xs text-muted">
                      No valid rows yet. Map Title and Artist to see the preview.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[430px] overflow-y-auto">
                    {transformed.releases.slice(0, 100).map((release, index) => (
                      <div
                        key={`${release.title}-${index}`}
                        className="flex items-start gap-3 border-b border-white/[0.04] px-4 py-3 last:border-b-0"
                      >
                        <span className="mt-0.5 w-5 shrink-0 text-right text-[9px] tabular-nums text-muted/35">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-cream/90">
                            {release.title}
                          </p>
                          <p className="truncate text-[10px] text-muted">
                            {release.artist}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] text-muted/55">
                            {[
                              release.year ?? undefined,
                              release.format,
                              release.condition ?? undefined,
                              release.rating ? `${release.rating}★` : undefined,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] tabular-nums text-accent/80">
                            {release.purchasePrice !== null
                              ? formatPrice(
                                  release.purchasePrice,
                                  release.purchaseCurrency,
                                )
                              : '—'}
                          </p>
                          {release.purchaseDate && (
                            <p className="mt-0.5 text-[9px] text-muted/45">
                              {release.purchaseDate}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {transformed.releases.length > 100 && (
                      <p className="px-4 py-3 text-center text-[10px] text-muted/50">
                        Showing first 100 of {transformed.releases.length}.
                      </p>
                    )}
                  </div>
                )}

                {transformed.skipped > 0 && (
                  <p className="flex items-center gap-2 border-t border-white/[0.05] bg-coral/[0.03] px-4 py-2.5 text-[10px] text-coral/80">
                    <AlertTriangle size={11} />
                    {pluralize(transformed.skipped, 'row')} skipped: missing title or
                    artist.
                  </p>
                )}
              </section>

              <section className="panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-cream">
                      {pluralize(transformed.releases.length, 'release')} ready
                      {transformed.skipped > 0 ? ` · ${transformed.skipped} skipped` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Duplicates already in the library are skipped automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => importMutation.mutate(transformed.releases)}
                    disabled={!ready || importMutation.isPending}
                    className="btn btn-primary shrink-0"
                  >
                    {importMutation.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    Import {transformed.releases.length || ''}
                  </button>
                </div>
              </section>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
