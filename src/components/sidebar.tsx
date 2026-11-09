import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChartNoAxesColumnIncreasing,
  Compass,
  Disc3,
  Heart,
  LibraryBig,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, pluralize } from '@/lib/utils';
import { Logo } from './logo';
import { useApp } from './app-context';

const formatDot: Record<string, string> = {
  CD: 'bg-accent',
  Vinyl: 'bg-coral',
  Cassette: 'bg-sky-400/70',
  Digital: 'bg-violet-400/70',
  Other: 'bg-white/30',
};

export function Sidebar() {
  const { openAdd } = useApp();
  const { pathname } = useLocation();
  const libraryActive =
    pathname === '/' || pathname.startsWith('/releases/');
  const discoverActive = pathname.startsWith('/discover');
  const wishlistActive = pathname.startsWith('/wishlist');
  const insightsActive = pathname.startsWith('/stats');
  const settingsActive =
    pathname.startsWith('/settings') || pathname.startsWith('/import/');
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    staleTime: 60_000,
  });

  const counts = new Map(
    (data?.byFormat ?? []).map((item) => [item.format, item.count]),
  );
  const rows = ['CD', 'Vinyl', 'Cassette'].map((format) => ({
    format,
    count: counts.get(format) ?? 0,
  }));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/[0.06] bg-ink-900/40 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Link to="/" aria-label="Sleeve home">
          <Logo />
        </Link>
      </div>

      <nav className="mt-9 space-y-1">
        <Link
          to="/"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            libraryActive
              ? 'bg-white/[0.07] text-cream'
              : 'text-muted hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          <LibraryBig
            size={18}
            className={libraryActive ? 'text-accent' : 'text-muted'}
          />
          Library
          <span className="ml-auto text-[11px] tabular-nums text-muted/60">
            {data?.total ?? '—'}
          </span>
        </Link>
        <Link
          to="/discover"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            discoverActive
              ? 'bg-white/[0.07] text-cream'
              : 'text-muted hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          <Compass
            size={18}
            className={discoverActive ? 'text-accent' : 'text-muted'}
          />
          Discover
        </Link>
        <Link
          to="/wishlist"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            wishlistActive
              ? 'bg-white/[0.07] text-cream'
              : 'text-muted hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          <Heart
            size={18}
            className={wishlistActive ? 'text-accent' : 'text-muted'}
          />
          Wishlist
        </Link>
        <Link
          to="/stats"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            insightsActive
              ? 'bg-white/[0.07] text-cream'
              : 'text-muted hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          <ChartNoAxesColumnIncreasing
            size={18}
            className={insightsActive ? 'text-accent' : 'text-muted'}
          />
          Insights
        </Link>
        <Link
          to="/settings"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            settingsActive
              ? 'bg-white/[0.07] text-cream'
              : 'text-muted hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          <Settings2
            size={18}
            className={settingsActive ? 'text-accent' : 'text-muted'}
          />
          Settings
        </Link>
      </nav>

      <div className="mt-9 px-3">
        <p className="eyebrow mb-3">On the shelf</p>
        <div className="space-y-2.5">
          {rows.map(({ format, count }) => (
            <div
              key={format}
              className="flex items-center gap-2.5 text-xs text-muted"
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  formatDot[format] ?? 'bg-white/30',
                )}
              />
              <span>{format}</span>
              <span className="ml-auto tabular-nums text-muted/70">{count}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] text-muted">
          <Disc3 size={14} className="text-accent/70" />
          {pluralize(data?.totalArtists ?? 0, 'artist')}
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/15 via-accent/[0.06] to-transparent p-4">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Sparkles size={15} />
          </div>
          <p className="font-display text-sm font-semibold text-cream">
            Grow the collection
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Search MusicBrainz and pull in cover art, label and tracklist.
          </p>
          <button
            type="button"
            onClick={() => openAdd()}
            className="btn btn-primary mt-3 w-full py-2 text-xs"
          >
            <Plus size={14} />
            Add a release
          </button>
        </div>
        <p className="px-1 text-[10px] tracking-[0.16em] text-muted/40 uppercase">
          Sleeve · MVP 0.1
        </p>
      </div>
    </aside>
  );
}
