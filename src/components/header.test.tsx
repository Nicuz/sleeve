import { afterAll, afterEach, expect, mock, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import type { GlobalSearchResponse } from '@/lib/types';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

const globalSearch = mock(async (query: string) => response(query));

mock.module('@/lib/api', () => ({
  api: { globalSearch },
  ApiError: class ApiError extends Error {},
}));

const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { AppProvider } = await import('./app-context');
const { Header } = await import('./header');

function response(query: string): GlobalSearchResponse {
  return {
    query,
    releases: {
      items: [
        {
          id: 'release-1',
          title: 'American Idiot',
          artist: 'Green Day',
          artistId: 'artist-1',
          year: 2004,
          format: 'CD',
          coverUrl: null,
          track: null,
        },
      ],
      total: 1,
    },
    artists: {
      items: [{ name: 'Green Day', artistId: 'artist-1', count: 1 }],
      total: 1,
    },
    wishlist: { items: [], total: 0 },
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <MemoryRouter initialEntries={['/discover']}>
          <Header />
          <LocationProbe />
        </MemoryRouter>
      </AppProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  globalSearch.mockClear();
});

afterAll(() => {
  mock.restore();
});

test('shows global results without leaving the current page', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'green' } });

  await screen.findByRole('option', { name: /American Idiot/ });
  expect(screen.getByRole('option', { name: /1 release in your library/ })).toBeTruthy();
  expect(screen.getByTestId('location').textContent).toBe('/discover');
  expect(globalSearch).toHaveBeenCalledWith('green', 6, expect.anything());
});

test('opens a result with the keyboard', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'green' } });
  await screen.findByRole('option', { name: /American Idiot/ });

  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(screen.getByTestId('location').textContent).toBe('/releases/release-1');
});

test('enter submits the query to the library', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'green' } });
  await screen.findByRole('option', { name: /American Idiot/ });
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(screen.getByTestId('location').textContent).toBe('/?q=green');
});
