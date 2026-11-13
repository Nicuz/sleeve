import { describe, expect, test } from 'bun:test';
import packageJson from '../package.json';
import { getBuildInfo } from './build-info';

describe('getBuildInfo', () => {
  test('prefers environment overrides', () => {
    expect(
      getBuildInfo(
        {
          SLEEVE_COMMIT: 'abc1234',
          SLEEVE_DIRTY: 'true',
          SLEEVE_BUILD_DATE: '2026-01-02T03:04:05.000Z',
        },
        new Date('2030-01-01T00:00:00.000Z'),
      ),
    ).toEqual({
      version: packageJson.version,
      commit: 'abc1234',
      dirty: true,
      buildDate: '2026-01-02T03:04:05.000Z',
    });
  });

  test('honours an explicit clean flag', () => {
    const info = getBuildInfo(
      {
        SLEEVE_COMMIT: 'abc1234',
        SLEEVE_DIRTY: 'false',
        SLEEVE_BUILD_DATE: '2026-01-02T03:04:05.000Z',
      },
      new Date('2030-01-01T00:00:00.000Z'),
    );

    expect(info.dirty).toBe(false);
  });

  test('uses the supplied clock when no build date is set', () => {
    const info = getBuildInfo(
      {
        SLEEVE_COMMIT: 'abc1234',
        SLEEVE_DIRTY: 'false',
      },
      new Date('2030-01-01T00:00:00.000Z'),
    );

    expect(info.buildDate).toBe('2030-01-01T00:00:00.000Z');
  });
});
