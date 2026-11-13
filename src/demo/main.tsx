import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AppProvider } from '../components/app-context';
import { ErrorBoundary } from '../components/error-boundary';
import { ToastProvider } from '../components/toast';
import { SettingsProvider } from '../lib/settings';
import { installDemoApi } from './api';
import '../index.css';

installDemoApi();
document.title = 'Sleeve — Demo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function DemoNotice() {
  return (
    <div className="fixed bottom-20 left-1/2 z-[95] -translate-x-1/2 rounded-full border border-white/10 bg-ink-900/90 px-3 py-1.5 text-[11px] font-medium text-muted shadow-lg backdrop-blur-md sm:bottom-5">
      Demo data · read-only · resets on reload
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ToastProvider>
          <SettingsProvider>
            <ErrorBoundary>
              <AppProvider>
                <App />
                <DemoNotice />
              </AppProvider>
            </ErrorBoundary>
          </SettingsProvider>
        </ToastProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
