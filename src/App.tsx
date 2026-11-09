import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { AddReleaseDialog } from '@/components/add-release-dialog';
import { LibraryPage } from '@/pages/library';
import { StatsPage } from '@/pages/stats';
import { ReleasePage } from '@/pages/release';
import { ArtistPage } from '@/pages/artist';
import { SettingsPage } from '@/pages/settings';
import { WishlistPage } from '@/pages/wishlist';
import { DiscoverPage } from '@/pages/discover';
const ImportCsvPage = lazy(() =>
  import('@/pages/import-csv').then((module) => ({
    default: module.ImportCsvPage,
  })),
);
import { OfflineBanner } from '@/components/offline-banner';

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
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/releases/:id" element={<ReleasePage />} />
            <Route path="/artists/:mbid" element={<ArtistPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route
              path="/import/csv"
              element={
                <Suspense
                  fallback={
                    <div className="panel mt-8 flex items-center justify-center px-6 py-20 text-sm text-muted">
                      Loading CSV import…
                    </div>
                  }
                >
                  <ImportCsvPage />
                </Suspense>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <MobileNav />
      <OfflineBanner />
      <AddReleaseDialog />
    </div>
  );
}
