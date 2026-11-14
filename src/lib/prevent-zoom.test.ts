import { expect, test } from 'bun:test';
import { installZoomGuards } from './prevent-zoom';

function createTarget() {
  return new EventTarget() as unknown as Document;
}

test('blocks iOS pinch gesture events', () => {
  const target = createTarget();
  installZoomGuards(target);

  for (const type of ['gesturestart', 'gesturechange']) {
    const event = new Event(type, { cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
});
