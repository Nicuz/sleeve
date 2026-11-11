import { afterAll, afterEach, beforeAll, expect, mock, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import type { ImportMode, ImportPreview, ImportResult } from '@/lib/types';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

const previewImport = mock(async (_payload: unknown, mode: ImportMode) => preview(mode));
const importData = mock(async (_payload: unknown, mode: ImportMode) => result(mode));

mock.module('@/lib/api', () => ({
  api: { previewImport, importData },
  ApiError: class ApiError extends Error {},
}));
mock.module('./toast', () => ({
  useToast: () => ({ toast: () => undefined }),
}));

const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { act, cleanup, fireEvent, render, screen, waitFor } = await import(
  '@testing-library/react'
);
const { ImportBackupDialog } = await import('./import-backup-dialog');

function preview(mode: ImportMode): ImportPreview {
  return {
    mode,
    source: {
      app: 'sleeve',
      version: 1,
      exportedAt: '2026-11-11T10:00:00.000Z',
    },
    canReplace: true,
    incoming: {
      releases: 2,
      tracks: 20,
      wishlist: 1,
      saved: 0,
      follows: 1,
      hasSettings: true,
    },
    importable: {
      releases: 2,
      wishlist: 1,
      saved: 0,
      follows: 1,
      hasSettings: true,
    },
    duplicates: { releases: 0, wishlist: 0, saved: 0, follows: 0 },
    invalid: { releases: 0, wishlist: 0, saved: 0, follows: 0, settings: 0 },
    current: { releases: 10, tracks: 100, wishlist: 2, saved: 1, follows: 3 },
    warnings: [],
  };
}

function result(mode: ImportMode): ImportResult {
  return {
    mode,
    backup: {
      name: 'pre-import-test.db',
      bytes: 1024,
      createdAt: '2026-11-11T10:00:00.000Z',
    },
    importedReleases: 2,
    skippedReleases: 0,
    invalidReleases: 0,
    importedWishlist: 1,
    skippedWishlist: 0,
    invalidWishlist: 0,
    importedSaved: 0,
    skippedSaved: 0,
    invalidSaved: 0,
    importedFollows: 1,
    skippedFollows: 0,
    invalidFollows: 0,
    importedSettings: 1,
    invalidSettings: 0,
  };
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportBackupDialog open onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

async function chooseFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('File input not found');
  const file = new File(['{"app":"sleeve","version":1}'], 'backup.json', {
    type: 'application/json',
  });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
    await Promise.resolve();
  });
}

beforeAll(() => {
  previewImport.mockClear();
  importData.mockClear();
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  mock.restore();
});

test('previews a backup and gates destructive replace behind RESTORE', async () => {
  const { container } = renderDialog();
  await chooseFile(container);

  await screen.findByText(/This backup contains 2 releases/);
  expect(screen.getAllByText('Add to my library').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Replace my library').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: /Replace my library/ }));
  await waitFor(() =>
    expect(previewImport).toHaveBeenLastCalledWith(expect.anything(), 'replace'),
  );

  const replaceButton = (await screen.findByRole('button', {
    name: 'Replace library',
  })) as HTMLButtonElement;
  expect(replaceButton.disabled).toBe(true);

  fireEvent.change(screen.getByPlaceholderText('RESTORE'), {
    target: { value: 'RESTORE' },
  });
  await waitFor(() => expect(replaceButton.disabled).toBe(false));

  fireEvent.click(replaceButton);
  await waitFor(() =>
    expect(importData).toHaveBeenCalledWith(expect.anything(), 'replace'),
  );
});

test('does not require confirmation for add-to-library merge', async () => {
  previewImport.mockClear();
  importData.mockClear();
  const { container } = renderDialog();
  await chooseFile(container);

  await screen.findByText(/This backup contains 2 releases/);
  const mergeButton = screen.getByRole('button', {
    name: 'Add to my library',
  }) as HTMLButtonElement;
  expect(mergeButton.disabled).toBe(false);

  fireEvent.click(mergeButton);
  await waitFor(() =>
    expect(importData).toHaveBeenCalledWith(expect.anything(), 'merge'),
  );
});
