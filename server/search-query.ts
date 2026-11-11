import type { Prisma } from '@prisma/client';
import type { ParsedSearchQuery, SearchOperator } from '../shared/search-query';

function textMatch(text: string): Prisma.ReleaseWhereInput {
  return {
    OR: [
      { title: { contains: text } },
      { artist: { contains: text } },
      { label: { contains: text } },
      { catalogNumber: { contains: text } },
      { genres: { contains: text } },
      { tracks: { some: { title: { contains: text } } } },
    ],
  };
}

function yearMatch(value: string): Prisma.ReleaseWhereInput | null {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year) || year < 1000 || year > 9999) return null;
  return {
    OR: [{ year }, { releaseDate: { startsWith: String(year) } }],
  };
}

function filterClause(
  key: SearchOperator,
  value: string,
): Prisma.ReleaseWhereInput | null {
  switch (key) {
    case 'title':
      return { title: { contains: value } };
    case 'artist':
      return { artist: { contains: value } };
    case 'label':
      return { label: { contains: value } };
    case 'genre':
      return { genres: { contains: value } };
    case 'track':
      return { tracks: { some: { title: { contains: value } } } };
    case 'format':
      return {
        OR: [{ format: { contains: value } }, { formatDetail: { contains: value } }],
      };
    case 'year':
      return yearMatch(value);
    default:
      return null;
  }
}

function combine(clauses: Prisma.ReleaseWhereInput[]) {
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses } satisfies Prisma.ReleaseWhereInput;
}

export function releaseWhereFromQuery(
  parsed: ParsedSearchQuery,
  options: { includeText?: boolean } = {},
): Prisma.ReleaseWhereInput | undefined {
  const { includeText = true } = options;
  const clauses: Prisma.ReleaseWhereInput[] = [];

  if (includeText && parsed.text) clauses.push(textMatch(parsed.text));

  for (const [key, value] of Object.entries(parsed.filters)) {
    if (!value) continue;
    const clause = filterClause(key as SearchOperator, value);
    if (clause) clauses.push(clause);
  }

  return combine(clauses);
}

export function wishlistWhereFromQuery(
  parsed: ParsedSearchQuery,
  options: { includeText?: boolean } = {},
): Prisma.WishlistItemWhereInput | undefined {
  const { includeText = true } = options;
  const clauses: Prisma.WishlistItemWhereInput[] = [];

  if (includeText && parsed.text) {
    clauses.push({
      OR: [
        { title: { contains: parsed.text } },
        { artist: { contains: parsed.text } },
        { label: { contains: parsed.text } },
        { catalogNumber: { contains: parsed.text } },
      ],
    });
  }

  const { title, artist, label, format, year } = parsed.filters;
  if (title) clauses.push({ title: { contains: title } });
  if (artist) clauses.push({ artist: { contains: artist } });
  if (label) clauses.push({ label: { contains: label } });
  if (format) {
    clauses.push({
      OR: [{ format: { contains: format } }, { formatDetail: { contains: format } }],
    });
  }
  if (year) {
    const parsedYear = Number.parseInt(year, 10);
    if (Number.isFinite(parsedYear) && parsedYear >= 1000 && parsedYear <= 9999) {
      clauses.push({
        OR: [{ year: parsedYear }, { releaseDate: { startsWith: String(parsedYear) } }],
      });
    }
  }

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}
