import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Database,
  Disc3,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileUp,
  Grid2x2,
  HardDrive,
  List,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  ACCENTS,
  SORT_OPTIONS,
  useSettings,
  type AccentKey,
} from '@/lib/settings';
import {
  CONDITIONS,
  CURRENCIES,
  cn,
  FORMAT_OPTIONS,
  pluralize,
} from '@/lib/utils';
import { useToast } from '@/components/toast';

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.07] bg-white/[0.03] text-accent">
        <Icon size={16} />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold text-cream">
          {title}
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-2.5 last:border-b-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-xs text-cream/80">{value}</dd>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteText, setDeleteText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    staleTime: 60_000,
  });

  const { data: cacheInfo } = useQuery({
    queryKey: ['metadata-cache'],
    queryFn: api.metadataCacheInfo,
    staleTime: 30_000,
  });

  const clearMetadataCache = useMutation({
    mutationFn: api.clearMetadataCache,
    onSuccess: ({ deleted }) => {
      queryClient.setQueryData(['metadata-cache'], {
        count: 0,
        oldest: null,
        newest: null,
      });
      queryClient.invalidateQueries({ queryKey: ['metadata-cache'] });
      toast(`${pluralize(deleted, 'cached entry', 'cached entries')} cleared`, 'info');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not clear the metadata cache',
        'error',
      );
    },
  });

  const clearLibrary = useMutation({
    mutationFn: () => api.clearLibrary(deleteText),
    onSuccess: ({ deleted }) => {
      queryClient.invalidateQueries();
      queryClient.removeQueries({ queryKey: ['release'] });
      setDeleteText('');
      toast(
        `${pluralize(deleted, 'release')} removed from the library`,
        'info',
      );
    },
    onError: (error) => {
      toast(
        error instanceof ApiError
          ? error.message
          : 'Could not clear the library',
        'error',
      );
    },
  });

  function downloadExport(format: 'json' | 'csv') {
    const anchor = document.createElement('a');
    anchor.href = api.exportLibraryUrl(format);
    anchor.download = '';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast(`Preparing ${format.toUpperCase()} export`, 'info');
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = await api.importData(parsed);
      queryClient.invalidateQueries();
      queryClient.removeQueries({ queryKey: ['release'] });
      if (result.importedReleases + result.importedWishlist === 0) {
        toast('Backup read: nothing new to import.', 'info');
      } else {
        toast(
          `Imported ${pluralize(result.importedReleases, 'release')} and ${pluralize(result.importedWishlist, 'wishlist item')}.`,
          'success',
        );
      }
      if (result.invalidReleases + result.invalidWishlist > 0) {
        toast(
          `${pluralize(result.invalidReleases + result.invalidWishlist, 'item')} could not be read.`,
          'error',
        );
      }
    } catch (error) {
      toast(
        error instanceof SyntaxError
          ? 'That file is not valid JSON.'
          : error instanceof Error
            ? error.message
            : 'Could not import the backup.',
        'error',
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="pb-24">
      <header className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <SlidersHorizontal size={12} />
            Preferences
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
            Make Sleeve yours.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            Tune the look, set library defaults and take ownership of your
            collection data.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-muted sm:self-auto">
          <Check size={12} className="text-accent" />
          Saved in this browser
        </span>
      </header>

      <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <section className="panel p-5 sm:p-6">
            <SectionHeading
              icon={Palette}
              title="Appearance"
              description="Pick the accent that sits beside your records. Applied across the whole app."
            />

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
                const accent = ACCENTS[key];
                const selected = settings.accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateSettings({ accent: key })}
                    aria-pressed={selected}
                    className={cn(
                      'flex flex-col items-center rounded-xl border px-2 py-3 transition',
                      selected
                        ? 'border-accent/40 bg-accent/[0.06]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
                    )}
                  >
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${accent.accent}, ${accent.soft})`,
                        boxShadow: `0 0 18px -4px ${accent.accent}`,
                      }}
                    >
                      {selected && (
                        <Check size={15} className="text-ink-950" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'mt-2 text-[10px] font-medium',
                        selected ? 'text-cream' : 'text-muted',
                      )}
                    >
                      {accent.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-950/40 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent">
                <Disc3 size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-cream">Accent preview</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  Buttons, badges and highlights update instantly.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary pointer-events-none py-2 text-xs"
                tabIndex={-1}
              >
                <Plus size={13} />
                Add release
              </button>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading
              icon={SlidersHorizontal}
              title="Library defaults"
              description="Applied when filters are empty and when you add a manual release."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">Default format</span>
                <select
                  value={settings.defaultFormat}
                  onChange={(event) =>
                    updateSettings({ defaultFormat: event.target.value })
                  }
                  className="input"
                >
                  {FORMAT_OPTIONS.map((format) => (
                    <option key={format}>{format}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label">Default condition</span>
                <select
                  value={settings.defaultCondition}
                  onChange={(event) =>
                    updateSettings({ defaultCondition: event.target.value })
                  }
                  className="input"
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition}>{condition}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label">Default currency</span>
                <select
                  value={settings.defaultCurrency}
                  onChange={(event) =>
                    updateSettings({ defaultCurrency: event.target.value })
                  }
                  className="input"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className="field-label">Default view</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1">
                  <button
                    type="button"
                    onClick={() => updateSettings({ defaultView: 'grid' })}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition',
                      settings.defaultView === 'grid'
                        ? 'bg-white/10 text-cream'
                        : 'text-muted hover:text-cream',
                    )}
                  >
                    <Grid2x2 size={13} />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ defaultView: 'list' })}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition',
                      settings.defaultView === 'list'
                        ? 'bg-white/10 text-cream'
                        : 'text-muted hover:text-cream',
                    )}
                  >
                    <List size={13} />
                    List
                  </button>
                </div>
              </div>

              <label>
                <span className="field-label">Default sort</span>
                <select
                  value={settings.defaultSort}
                  onChange={(event) =>
                    updateSettings({
                      defaultSort: event.target.value as typeof settings.defaultSort,
                    })
                  }
                  className="input"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-muted/60">
              MusicBrainz editions keep their own format. Your condition, view
              and sort defaults apply across the app.
            </p>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading
              icon={Database}
              title="Library data"
              description="Your collection lives in a local SQLite database. Export, import or start fresh."
            />

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => downloadExport('json')}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <FileJson size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-cream">
                    Export JSON
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    Releases, tracks and wishlist
                  </span>
                </span>
                <Download
                  size={14}
                  className="shrink-0 text-muted transition group-hover:text-cream"
                />
              </button>

              <button
                type="button"
                onClick={() => downloadExport('csv')}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <FileSpreadsheet size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-cream">
                    Export CSV
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    One row per track, spreadsheet ready
                  </span>
                </span>
                <Download
                  size={14}
                  className="shrink-0 text-muted transition group-hover:text-cream"
                />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  {importing ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <FileUp size={17} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-cream">
                    Import JSON
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    Merge backup; duplicates skipped
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />

              <Link
                to="/import/csv"
                className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Table2 size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-cream">
                    Import Discogs CSV
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    Map columns visually before import
                  </span>
                </span>
              </Link>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-muted">
              <HardDrive size={13} className="text-accent/70" />
              {pluralize(stats?.total ?? 0, 'release')} ·{' '}
              {pluralize(stats?.totalTracks ?? 0, 'track')} stored locally
            </div>

            <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/[0.05] p-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={16} className="mt-0.5 text-red-300" />
                <div>
                  <p className="text-xs font-semibold text-red-200">
                    Danger zone
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-red-200/60">
                    Removes every release, track and note. Export your library
                    before continuing.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={deleteText}
                  onChange={(event) => setDeleteText(event.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="input flex-1"
                  aria-label="Type DELETE to confirm"
                />
                <button
                  type="button"
                  onClick={() => clearLibrary.mutate()}
                  disabled={deleteText !== 'DELETE' || clearLibrary.isPending}
                  className="btn btn-danger shrink-0"
                >
                  <Trash2 size={14} />
                  {clearLibrary.isPending ? 'Clearing…' : 'Clear library'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel p-5 sm:p-6">
            <SectionHeading
              icon={HardDrive}
              title="About Sleeve"
              description="A private listening archive for the records you own."
            />
            <dl className="mt-5">
              <SettingRow label="Version" value="0.1.0" />
              <SettingRow label="Storage" value="SQLite · local" />
              <SettingRow
                label="Metadata"
                value="MusicBrainz + Cover Art Archive"
              />
              <SettingRow label="Runtime" value="Bun + React" />
              <SettingRow
                label="Collection"
                value={`${pluralize(stats?.total ?? 0, 'release')} · ${pluralize(stats?.totalTracks ?? 0, 'track')}`}
              />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://musicbrainz.org"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] text-muted transition hover:border-white/20 hover:text-cream"
              >
                MusicBrainz
                <ExternalLink size={11} />
              </a>
              <a
                href="https://coverartarchive.org"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] text-muted transition hover:border-white/20 hover:text-cream"
              >
                Cover Art Archive
                <ExternalLink size={11} />
              </a>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading
              icon={RefreshCw}
              title="Metadata cache"
              description="MusicBrainz lookups are cached locally. Clearing forces fresh requests."
            />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
              <div>
                <p className="text-xs font-medium text-cream">
                  {cacheInfo ? pluralize(cacheInfo.count, 'cached entry', 'cached entries') : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-muted/60">
                  Searches 30 min · details 7 days
                </p>
              </div>
              <button
                type="button"
                onClick={() => clearMetadataCache.mutate()}
                disabled={clearMetadataCache.isPending || !cacheInfo?.count}
                className="btn btn-secondary shrink-0 py-2 text-xs"
              >
                {clearMetadataCache.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Clear
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted/60">
              Refresh individual releases from their release page.
            </p>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading
              icon={RotateCcw}
              title="Reset preferences"
              description="Restore the amber theme and default library settings. Your collection stays untouched."
            />
            <button
              type="button"
              onClick={() => {
                resetSettings();
                toast('Preferences reset', 'info');
              }}
              className="btn btn-secondary mt-4 w-full"
            >
              <RotateCcw size={14} />
              Reset to defaults
            </button>
          </section>

          <section className="panel p-5">
            <p className="text-[10px] leading-relaxed text-muted/60">
              Preferences are stored in this browser. Export your collection
              regularly if you want a portable backup.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
