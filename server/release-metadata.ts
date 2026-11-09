import { prisma } from './db';
import {
  getRelease,
  searchReleases,
  type ReleaseDetail,
  type SearchResult,
} from './musicbrainz';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/×/g, ' x ')
    .replace(/÷/g, ' divide ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 0.8;
  return 0;
}

function cleanQuery(value: string): string {
  return value.replace(/"/g, '').trim();
}

type MatchableRelease = {
  id: string;
  title: string;
  artist: string;
  format: string;
  year: number | null;
  barcode: string | null;
  catalogNumber: string | null;
  musicbrainzId: string | null;
};

function scoreCandidate(release: MatchableRelease, candidate: SearchResult): number {
  const title = similarity(normalize(candidate.title), normalize(release.title));
  const artist = similarity(normalize(candidate.artist), normalize(release.artist));
  if (title < 0.7 || artist < 0.7) return 0;

  const format = candidate.format === release.format ? 5 : 0;
  const year =
    release.year && candidate.year && Math.abs(release.year - candidate.year) <= 1
      ? 5
      : 0;
  const barcode =
    release.barcode &&
    candidate.barcode &&
    release.barcode.replace(/\s/g, '') === candidate.barcode.replace(/\s/g, '')
      ? 25
      : 0;
  const catalog =
    release.catalogNumber &&
    candidate.catalogNumber &&
    normalize(release.catalogNumber) === normalize(candidate.catalogNumber)
      ? 15
      : 0;
  const relevance = Math.min(10, (candidate.score ?? 0) / 10);

  return title * 50 + artist * 35 + format + year + barcode + catalog + relevance;
}

export async function applyReleaseDetail(releaseId: string, detail: ReleaseDetail) {
  return prisma.$transaction(async (tx) => {
    await tx.track.deleteMany({ where: { releaseId } });
    return tx.release.update({
      where: { id: releaseId },
      data: {
        musicbrainzId: detail.musicbrainzId,
        title: detail.title,
        artist: detail.artist,
        artistId: detail.artistId,
        year: detail.year,
        releaseDate: detail.releaseDate,
        country: detail.country,
        label: detail.label,
        catalogNumber: detail.catalogNumber,
        barcode: detail.barcode,
        formatDetail: detail.formatDetail,
        coverUrl: detail.coverUrl,
        genres: detail.genres.length ? detail.genres.join(', ') : null,
        trackCount: detail.trackCount,
        tracks: detail.tracks.length
          ? {
              create: detail.tracks.map((track) => ({
                position: track.position,
                disc: track.disc,
                number: track.number,
                title: track.title,
                duration: track.duration,
                artist: track.artist,
              })),
            }
          : undefined,
      },
      include: {
        tracks: {
          orderBy: [{ disc: 'asc' }, { number: 'asc' }, { position: 'asc' }],
        },
      },
    });
  });
}

export async function enrichReleaseById(releaseId: string, signal?: AbortSignal) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
  });
  if (!release) return null;

  if (release.musicbrainzId) {
    const detail = await getRelease(release.musicbrainzId, signal);
    const updated = await applyReleaseDetail(releaseId, detail);
    return {
      status: 'matched' as const,
      release: updated,
      match: {
        title: detail.title,
        artist: detail.artist,
        score: 100,
      },
    };
  }

  const matchable: MatchableRelease = {
    id: release.id,
    title: release.title,
    artist: release.artist,
    format: release.format,
    year: release.year,
    barcode: release.barcode,
    catalogNumber: release.catalogNumber,
    musicbrainzId: release.musicbrainzId,
  };

  let results: SearchResult[] = [];
  if (release.barcode) {
    results = await searchReleases(
      `barcode:${release.barcode.replace(/\s/g, '')}`,
      10,
      signal,
    );
  }
  if (results.length === 0) {
    results = await searchReleases(
      `artist:"${cleanQuery(release.artist)}" AND release:"${cleanQuery(release.title)}"`,
      20,
      signal,
    );
  }
  if (results.length === 0) {
    results = await searchReleases(cleanQuery(release.title), 20, signal);
  }

  const ranked = results
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(matchable, candidate),
    }))
    .filter((entry) => entry.score >= 75)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { status: 'unmatched' as const };
  }

  const best = ranked[0];
  const duplicate = await prisma.release.findFirst({
    where: {
      musicbrainzId: best.candidate.musicbrainzId,
      id: { not: releaseId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { status: 'duplicate' as const };
  }

  const detail = await getRelease(best.candidate.musicbrainzId, signal);
  const updated = await applyReleaseDetail(releaseId, detail);
  return {
    status: 'matched' as const,
    release: updated,
    match: {
      title: best.candidate.title,
      artist: best.candidate.artist,
      score: Math.round(best.score),
    },
  };
}

export async function applyReleaseMatch(
  releaseId: string,
  musicbrainzId: string,
  signal?: AbortSignal,
) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true },
  });
  if (!release) return null;

  const duplicate = await prisma.release.findFirst({
    where: { musicbrainzId, id: { not: releaseId } },
    select: { id: true },
  });
  if (duplicate) {
    return { status: 'duplicate' as const };
  }

  const detail = await getRelease(musicbrainzId, signal);
  const updated = await applyReleaseDetail(releaseId, detail);
  return {
    status: 'matched' as const,
    release: updated,
    match: {
      title: detail.title,
      artist: detail.artist,
      score: 100,
    },
  };
}
