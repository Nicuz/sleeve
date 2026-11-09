import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { AddReleaseDialog } from '@/components/add-release-dialog';
import { LibraryPage } from '@/pages/library';

function lazyPage<T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  name: keyof T,
) {
  return lazy(() =>
    loader().then((module) => ({ default: module[name] as ComponentType })),
  );
}

const StatsPage = lazyPage(() => import('@/pages/stats'), 'StatsPage');
const ReleasePage = lazyPage(() => import('@/pages/release'), 'ReleasePage');
const ArtistPage = lazyPage(() => import('@/pages/artist'), 'ArtistPage');
const SettingsPage = lazyPage(() => import('@/pages/settings'), 'SettingsPage');
const WishlistPage = lazyPage(() => import('@/pages/wishlist'), 'WishlistPage');
const DiscoverPage = lazyPage(() => import('@/pages/discover'), 'DiscoverPage');
const ImportCsvPage = lazyPage(() => import('@/pages/import-csv'), 'ImportCsvPage');
import { OfflineBanner } from '@/components/offline-banner';
import { UpdatePrompt } from '@/components/update-prompt';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <ScrollToTop />
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Header />
        <main className="mx-auto max-w-[1500px] px-4 pb-28 lg:px-10">
          <Suspense
            fallback={
              <div className="panel mt-8 flex items-center justify-center px-6 py-20 text-sm text-muted">
                Loading…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<LibraryPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/releases/:id" element={<ReleasePage />} />
              <Route path="/artists/:mbid" element={<ArtistPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/import/csv" element={<ImportCsvPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <MobileNav />
      <OfflineBanner />
      <UpdatePrompt />
      <AddReleaseDialog />
    </div>
  );
}
