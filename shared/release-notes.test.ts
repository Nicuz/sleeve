import { describe, expect, test } from 'bun:test';
import { extractReleaseNotes } from './release-notes';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Something new.

## [0.1.0] - 2026-11-13

### Added

- First release.

### Fixed

- An early bug.

## [0.0.1] - 2026-01-01

- Older release.
`;

describe('extractReleaseNotes', () => {
  test('extracts notes for a tag', () => {
    expect(extractReleaseNotes(CHANGELOG, 'v0.1.0')).toBe(
      '### Added\n\n- First release.\n\n### Fixed\n\n- An early bug.\n',
    );
  });

  test('accepts a version without the v prefix', () => {
    expect(extractReleaseNotes(CHANGELOG, '0.0.1')).toBe('- Older release.\n');
  });

  test('stops at the next release heading', () => {
    expect(extractReleaseNotes(CHANGELOG, 'Unreleased')).toContain('Something new.');
  });

  test('rejects a missing section', () => {
    expect(() => extractReleaseNotes(CHANGELOG, 'v9.9.9')).toThrow(
      'No changelog section found for 9.9.9.',
    );
  });

  test('rejects an empty section', () => {
    const empty = '# Changelog\n\n## [0.2.0]\n\n## [0.1.0]\n\n- Notes.\n';
    expect(() => extractReleaseNotes(empty, '0.2.0')).toThrow(
      'Changelog section for 0.2.0 is empty.',
    );
  });
});
