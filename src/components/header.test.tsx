import { afterAll, afterEach, expect, mock, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import type { GlobalSearchResponse } from '@/lib/types';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

const globalSearch = mock(async (query: string) => response(query));
const createRelease = mock(async () => ({ release: { title: 'Rumours' } }));
const deleteWishlistItem = mock(async () => ({ ok: true }));

mock.module('@/lib/api', () => ({
  api: { globalSearch, createRelease, deleteWishlistItem },
  ApiError: class ApiError extends Error {},
}));
mock.module('./toast', () => ({
  useToast: () => ({ toast: () => undefined }),
}));

const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { cleanup, fireEvent, render, screen, waitFor } = await import(
  '@testing-library/react'
);
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { AppProvider } = await import('./app-context');
const { Header } = await import('./header');

function response(query: string): GlobalSearchResponse {
  const wishlistMatch = /rum/i.test(query);
  return {
    query,
    scope: 'all',
    parsed: {
      text: query.replace(/^artist:"?|"?$/g, ''),
      filters: query.startsWith('artist:') ? { artist: 'green day' } : {},
    },
    releases: wishlistMatch
      ? { items: [], total: 0 }
      : {
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
    artists: wishlistMatch
      ? { items: [], total: 0 }
      : {
          items: [{ name: 'Green Day', artistId: 'artist-1', count: 1 }],
          total: 1,
        },
    wishlist: wishlistMatch
      ? {
          items: [
            {
              id: 'wish-1',
              title: 'Rumours',
              artist: 'Fleetwood Mac',
              artistId: null,
              year: 1977,
              format: 'Vinyl',
              coverUrl: null,
              musicbrainzId: null,
              releaseGroupId: null,
              releaseDate: '1977-02-04',
              country: 'US',
              label: 'Warner',
              catalogNumber: null,
              barcode: null,
              formatDetail: 'LP',
              notes: null,
            },
          ],
          total: 1,
        }
      : { items: [], total: 0 },
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
  createRelease.mockClear();
  deleteWishlistItem.mockClear();
  window.localStorage.clear();
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
  expect(globalSearch).toHaveBeenCalledWith(
    'green',
    { limit: 6, scope: 'all' },
    expect.anything(),
  );
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

test('changes the search scope', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'green' } });
  await screen.findByRole('option', { name: /American Idiot/ });
  fireEvent.click(screen.getByRole('button', { name: 'Wishlist' }));

  expect(globalSearch).toHaveBeenLastCalledWith(
    'green',
    { limit: 6, scope: 'wishlist' },
    expect.anything(),
  );
});

test('shows recent searches after clearing the input', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'green' } });
  await screen.findByRole('option', { name: /American Idiot/ });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
  fireEvent.focus(input);

  expect(await screen.findByRole('option', { name: /green/i })).toBeTruthy();
});

test('parses operators and highlights matching text', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'artist:"green day"' } });
  await screen.findByRole('option', { name: /American Idiot/ });

  expect(globalSearch).toHaveBeenCalledWith(
    'artist:"green day"',
    { limit: 6, scope: 'all' },
    expect.anything(),
  );
  expect(document.querySelectorAll('mark').length).toBeGreaterThan(0);
});

test('adds a wishlist hit to the library from the result row', async () => {
  renderHeader();
  const input = screen.getByRole('combobox', { name: /search your collection/i });

  fireEvent.change(input, { target: { value: 'rum' } });
  await screen.findByRole('option', { name: /Rumours/ });
  fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));

  await waitFor(() => expect(createRelease).toHaveBeenCalled());
  expect(deleteWishlistItem).toHaveBeenCalledWith('wish-1');
});
