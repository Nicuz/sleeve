function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractReleaseNotes(markdown: string, version: string): string {
  const target = version.replace(/^v/, '');
  const lines = markdown.split(/\r?\n/);
  const heading = new RegExp(`^##\\s+\\[${escapeRegExp(target)}\\]`);
  const start = lines.findIndex((line) => heading.test(line));

  if (start === -1) {
    throw new Error(`No changelog section found for ${target}.`);
  }

  let end = start + 1;
  while (end < lines.length && !/^##\s+\[/.test(lines[end])) {
    end += 1;
  }

  const notes = lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
  if (!notes) {
    throw new Error(`Changelog section for ${target} is empty.`);
  }

  return `${notes}\n`;
}
