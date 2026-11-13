import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractReleaseNotes } from '../shared/release-notes';

if (import.meta.main) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: bun scripts/changelog-section.ts <version>');
    process.exit(1);
  }

  try {
    const changelog = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8');
    process.stdout.write(extractReleaseNotes(changelog, version));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
