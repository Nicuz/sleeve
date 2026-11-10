import { Link, useLocation } from 'react-router-dom';
import {
  ChartNoAxesColumnIncreasing,
  Compass,
  Heart,
  LibraryBig,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from './app-context';

export function MobileNav() {
  const { openAdd } = useApp();
  const { pathname } = useLocation();
  const libraryActive = pathname === '/' || pathname.startsWith('/releases/');
  const discoverActive = pathname.startsWith('/discover');
  const wishlistActive = pathname.startsWith('/wishlist');
  const insightsActive = pathname.startsWith('/stats');

  const itemClass = (active: boolean) =>
    cn(
      'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition',
      active ? 'text-cream' : 'text-muted',
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5 items-center px-2 py-1">
        <Link to="/" className={itemClass(libraryActive)}>
          <LibraryBig size={19} className={libraryActive ? 'text-accent' : undefined} />
          Library
        </Link>
        <Link to="/discover" className={itemClass(discoverActive)}>
          <Compass size={19} className={discoverActive ? 'text-accent' : undefined} />
          Discover
        </Link>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openAdd()}
            className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-accent text-ink-950 transition active:scale-95"
            aria-label="Add release"
          >
            <Plus size={22} />
          </button>
        </div>
        <Link to="/wishlist" className={itemClass(wishlistActive)}>
          <Heart size={19} className={wishlistActive ? 'text-accent' : undefined} />
          Wishlist
        </Link>
        <Link to="/stats" className={itemClass(insightsActive)}>
          <ChartNoAxesColumnIncreasing
            size={19}
            className={insightsActive ? 'text-accent' : undefined}
          />
          Insights
        </Link>
      </div>
    </nav>
  );
}
