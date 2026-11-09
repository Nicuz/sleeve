import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AppProvider } from './components/app-context';
import { ErrorBoundary } from './components/error-boundary';
import { ToastProvider } from './components/toast';
import { SettingsProvider } from './lib/settings';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        function notify() {
          if (registration.waiting && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event('sleeve:update-ready'));
          }
        }
        notify();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') notify();
          });
        });
      })
      .catch(() => undefined);
  });
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <SettingsProvider>
            <ErrorBoundary>
              <AppProvider>
                <App />
              </AppProvider>
            </ErrorBoundary>
          </SettingsProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
