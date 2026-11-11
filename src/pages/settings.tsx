import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, Grid2x2, List, Loader2, Moon, Sun, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  ACCENTS,
  DEFAULT_COLLECTION_DEFAULTS,
  SORT_OPTIONS,
  useSettings,
  type AccentKey,
} from '@/lib/settings';
import type { AppSettings } from '@/lib/types';
import { CONDITIONS, CURRENCIES, cn, FORMAT_OPTIONS, pluralize } from '@/lib/utils';
import { ImportBackupDialog } from '@/components/import-backup-dialog';
import { useToast } from '@/components/toast';

function Section({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="px-1">
        <h2
          className={cn(
            'font-display text-base font-semibold tracking-tight',
            danger ? 'text-red-200' : 'text-cream',
          )}
        >
          {title}
        </h2>
      </div>
      <div
        className={cn(
          'panel p-5 sm:p-6',
          danger && 'border-red-400/20 bg-red-500/[0.03]',
        )}
      >
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-white/[0.04] py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-cream">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-xs text-cream/80">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteText, setDeleteText] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const saveDefaults = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => api.updateAppSettings(patch),
    onMutate: (patch) => {
      queryClient.setQueryData<{ settings: AppSettings }>(
        ['app-settings'],
        (current) => ({
          settings: {
            ...(current?.settings ?? DEFAULT_COLLECTION_DEFAULTS),
            ...patch,
          },
        }),
      );
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast(
        error instanceof ApiError ? error.message : 'Could not save library defaults',
        'error',
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });

  const resetPreferences = useMutation({
    mutationFn: () => api.updateAppSettings(DEFAULT_COLLECTION_DEFAULTS),
    onSuccess: (data) => {
      resetSettings();
      queryClient.setQueryData(['app-settings'], data);
      toast('Preferences reset', 'info');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not reset preferences',
        'error',
      );
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.stats(),
    staleTime: 60_000,
  });

  const { data: cacheInfo } = useQuery({
    queryKey: ['metadata-cache'],
    queryFn: api.metadataCacheInfo,
    staleTime: 30_000,
  });

  const { data: coverCacheInfo } = useQuery({
    queryKey: ['cover-cache'],
    queryFn: api.coverCacheInfo,
    staleTime: 30_000,
  });

  const clearCoverCache = useMutation({
    mutationFn: api.clearCoverCache,
    onSuccess: ({ deleted }) => {
      queryClient.setQueryData(['cover-cache'], { count: 0, bytes: 0 });
      queryClient.invalidateQueries({ queryKey: ['cover-cache'] });
      toast(`${pluralize(deleted, 'cached cover', 'cached covers')} cleared`, 'info');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not clear the cover cache',
        'error',
      );
    },
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
        error instanceof ApiError ? error.message : 'Could not clear the metadata cache',
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
      toast(`${pluralize(deleted, 'release')} removed from the library`, 'info');
    },
    onError: (error) => {
      toast(
        error instanceof ApiError ? error.message : 'Could not clear the library',
        'error',
      );
    },
  });

  function downloadBackup() {
    const anchor = document.createElement('a');
    anchor.href = api.exportBackupUrl();
    anchor.download = '';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast('Preparing backup download', 'info');
  }

  return (
    <div className="pb-24">
      <header className="mt-8">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream md:text-5xl">
            Make Sleeve yours.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            Tune the look, set library defaults and take ownership of your collection
            data.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        <Section title="Appearance">
          <div>
            <SettingRow
              label="Theme"
              description="Switch between the dark lounge and a light reading view."
            >
              <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1 sm:w-48">
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: 'dark' })}
                  aria-pressed={settings.theme === 'dark'}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition',
                    settings.theme === 'dark'
                      ? 'bg-white/10 text-cream'
                      : 'text-muted hover:text-cream',
                  )}
                >
                  <Moon size={13} />
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: 'light' })}
                  aria-pressed={settings.theme === 'light'}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition',
                    settings.theme === 'light'
                      ? 'bg-white/10 text-cream'
                      : 'text-muted hover:text-cream',
                  )}
                >
                  <Sun size={13} />
                  Light
                </button>
              </div>
            </SettingRow>

            <div className="flex flex-col gap-3 border-b border-white/[0.04] py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-cream">Accent color</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Buttons, badges and highlights update instantly.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
                  const accent = ACCENTS[key];
                  const selected = settings.accent === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateSettings({ accent: key })}
                      aria-pressed={selected}
                      aria-label={accent.label}
                      title={accent.label}
                      className={cn(
                        'grid h-10 w-10 place-items-center rounded-full border transition',
                        selected
                          ? 'border-accent/50 ring-2 ring-accent/20'
                          : 'border-white/[0.07] hover:border-white/25',
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${accent.accent}, ${accent.soft})`,
                      }}
                    >
                      {selected && <Check size={16} className="text-ink-950" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Library view">
          <div>
            <SettingRow label="View" description="Grid or list for the library.">
              <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1 sm:w-48">
                <button
                  type="button"
                  onClick={() => updateSettings({ defaultView: 'grid' })}
                  aria-pressed={settings.defaultView === 'grid'}
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
                  aria-pressed={settings.defaultView === 'list'}
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
            </SettingRow>

            <SettingRow label="Sort order" description="Initial ordering in the library.">
              <select
                value={settings.defaultSort}
                onChange={(event) =>
                  updateSettings({
                    defaultSort: event.target.value as typeof settings.defaultSort,
                  })
                }
                className="input w-full sm:w-48"
                aria-label="Default sort"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </SettingRow>
          </div>
        </Section>

        <Section title="Library defaults">
          <div>
            <SettingRow label="Format" description="Used for manual releases.">
              <select
                value={settings.defaultFormat}
                onChange={(event) =>
                  saveDefaults.mutate({ defaultFormat: event.target.value })
                }
                className="input w-full sm:w-48"
                aria-label="Default format"
              >
                {FORMAT_OPTIONS.map((format) => (
                  <option key={format}>{format}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Condition" description="Default grading on new entries.">
              <select
                value={settings.defaultCondition}
                onChange={(event) =>
                  saveDefaults.mutate({ defaultCondition: event.target.value })
                }
                className="input w-full sm:w-48"
                aria-label="Default condition"
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition}>{condition}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Currency" description="Used for purchase prices.">
              <select
                value={settings.defaultCurrency}
                onChange={(event) =>
                  saveDefaults.mutate({ defaultCurrency: event.target.value })
                }
                className="input w-full sm:w-48"
                aria-label="Default currency"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </SettingRow>
          </div>
        </Section>

        <Section title="Backup & restore">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent">
                <Download size={18} />
              </span>
              <p className="mt-3 text-sm font-semibold text-cream">Save a backup</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                One file with your releases, wishlist, saved items, followed artists and
                defaults.
              </p>
              <button
                type="button"
                onClick={downloadBackup}
                className="btn btn-primary mt-4 w-full sm:w-auto"
              >
                Download backup
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent">
                <Upload size={18} />
              </span>
              <p className="mt-3 text-sm font-semibold text-cream">Restore a backup</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Open a backup file and review what it contains before changing anything.
              </p>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="btn btn-secondary mt-4"
              >
                Choose backup file
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-muted">
            {pluralize(stats?.total ?? 0, 'release')} ·{' '}
            {pluralize(stats?.totalTracks ?? 0, 'track')} stored locally
          </div>
        </Section>

        <Section title="Metadata & cache">
          <div>
            <SettingRow
              label={
                cacheInfo
                  ? pluralize(cacheInfo.count, 'cached entry', 'cached entries')
                  : 'Cached entries'
              }
              description="Searches 30 min · details 7 days"
            >
              <button
                type="button"
                onClick={() => clearMetadataCache.mutate()}
                disabled={clearMetadataCache.isPending || !cacheInfo?.count}
                className="btn btn-secondary py-2 text-xs"
              >
                {clearMetadataCache.isPending && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Clear cache
              </button>
            </SettingRow>

            <SettingRow
              label="Cover cache"
              description={
                coverCacheInfo
                  ? `${pluralize(coverCacheInfo.count, 'image')} · ${formatBytes(coverCacheInfo.bytes)}`
                  : 'Cached cover images on disk'
              }
            >
              <button
                type="button"
                onClick={() => clearCoverCache.mutate()}
                disabled={clearCoverCache.isPending || !coverCacheInfo?.count}
                className="btn btn-secondary py-2 text-xs"
              >
                {clearCoverCache.isPending && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Clear covers
              </button>
            </SettingRow>
          </div>
        </Section>

        <Section title="About Sleeve">
          <dl>
            <InfoRow label="Version" value="0.1.0" />
            <InfoRow label="Storage" value="SQLite · local" />
            <InfoRow label="Metadata" value="MusicBrainz + Cover Art Archive" />
            <InfoRow label="Runtime" value="Bun + React" />
            <InfoRow
              label="Collection"
              value={`${pluralize(stats?.total ?? 0, 'release')} · ${pluralize(stats?.totalTracks ?? 0, 'track')}`}
            />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://musicbrainz.org"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] text-muted transition hover:border-white/20 hover:text-cream"
            >
              MusicBrainz
            </a>
            <a
              href="https://coverartarchive.org"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] text-muted transition hover:border-white/20 hover:text-cream"
            >
              Cover Art Archive
            </a>
          </div>
        </Section>

        <Section title="Preferences">
          <div>
            <SettingRow
              label="Reset preferences"
              description="Restore the amber theme, library view and database defaults."
            >
              <button
                type="button"
                onClick={() => resetPreferences.mutate()}
                disabled={resetPreferences.isPending}
                className="btn btn-secondary py-2 text-xs"
              >
                {resetPreferences.isPending && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                Reset defaults
              </button>
            </SettingRow>
          </div>
        </Section>

        <Section title="Danger zone" danger>
          <div className="flex flex-col gap-2 sm:flex-row">
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
              {clearLibrary.isPending ? 'Clearing…' : 'Clear library'}
            </button>
          </div>
        </Section>
      </div>
      <ImportBackupDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
