import { afterEach, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

const { cleanup, fireEvent, render } = await import('@testing-library/react');
const { CoverArt } = await import('./cover-art');

afterEach(() => cleanup());

test('tracks loaded state per cover URL', () => {
  const { container, rerender } = render(
    <CoverArt src="https://example.com/a.jpg" title="A" />,
  );
  const first = container.querySelector('img');
  expect(first).toBeTruthy();
  fireEvent.load(first as HTMLImageElement);
  expect(first?.className).toContain('opacity-100');

  rerender(<CoverArt src="https://example.com/b.jpg" title="B" />);
  const second = container.querySelector('img');
  expect(second).not.toBe(first);
  expect(second?.className).toContain('opacity-0');

  fireEvent.load(second as HTMLImageElement);
  expect(second?.className).toContain('opacity-100');
});

test('falls back after an image error', () => {
  const { container } = render(
    <CoverArt src="https://example.com/missing.jpg" title="Missing" />,
  );
  const image = container.querySelector('img');
  fireEvent.error(image as HTMLImageElement);
  expect(container.querySelector('img')).toBeNull();
});
