export const SEARCH_OPERATORS = [
  'artist',
  'label',
  'catalog',
  'year',
  'format',
  'track',
  'title',
  'genre',
] as const;

export type SearchOperator = (typeof SEARCH_OPERATORS)[number];

export type ParsedSearchQuery = {
  text: string;
  filters: Partial<Record<SearchOperator, string>>;
};

const TOKEN_PATTERN = /(?:[^\s"]+|"[^"]*")+/g;

function stripQuotes(value: string) {
  return value.replace(/^"+|"+$/g, '');
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const filters: Partial<Record<SearchOperator, string>> = {};
  const text: string[] = [];

  for (const token of raw.match(TOKEN_PATTERN) ?? []) {
    const match = /^([a-z]+):(.*)$/i.exec(token);
    if (match) {
      const key = match[1].toLowerCase() as SearchOperator;
      if (SEARCH_OPERATORS.includes(key)) {
        const value = stripQuotes(match[2]).trim();
        if (value) {
          filters[key] = value;
          continue;
        }
      }
    }
    text.push(stripQuotes(token));
  }

  return { text: text.join(' ').trim(), filters };
}

export function highlightTerms(parsed: ParsedSearchQuery): string[] {
  const terms = [
    parsed.text,
    parsed.filters.artist,
    parsed.filters.label,
    parsed.filters.catalog,
    parsed.filters.year,
    parsed.filters.format,
    parsed.filters.track,
    parsed.filters.title,
    parsed.filters.genre,
  ].filter((term): term is string => Boolean(term?.trim()));

  return [...new Set(terms.flatMap((term) => term.split(/\s+/)))].filter(
    (term) => term.length >= 2,
  );
}
