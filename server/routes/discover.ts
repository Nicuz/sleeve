import { Elysia } from 'elysia';
import { prisma } from '../db';
import { searchReleaseGroupsByTag, type DiscoverReleaseGroup } from '../musicbrainz';

const VARIOUS_ARTISTS_ID = '89ad4ac3-39f7-470e-963a-56509c546377';

export const discoverRoutes = new Elysia().get(
  '/api/discover',
  async ({ request, set }) => {
    const releases = await prisma.release.findMany({
      select: { genres: true, artistId: true, artist: true },
    });

    const genreCounts = new Map<string, number>();
    const ownedArtistIds = new Set<string>();
    const ownedArtistNames = new Set<string>();
    for (const release of releases) {
      if (release.artistId) ownedArtistIds.add(release.artistId);
      ownedArtistNames.add(release.artist.trim().toLowerCase());
      for (const genre of (release.genres ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([genre]) => genre);

    const sections: Array<{ genre: string; items: DiscoverReleaseGroup[] }> = [];
    const seenGroups = new Set<string>();
    const seenArtists = new Set<string>();
    let failed = 0;

    for (const genre of topGenres) {
      try {
        const groups = await searchReleaseGroupsByTag(genre, 15, request.signal);
        const items: DiscoverReleaseGroup[] = [];
        for (const group of groups) {
          if (group.secondaryTypes.length > 0) continue;
          if (group.artistId === VARIOUS_ARTISTS_ID) continue;
          if (group.artist.trim().toLowerCase() === 'various artists') continue;
          if (group.artistId && ownedArtistIds.has(group.artistId)) continue;
          if (ownedArtistNames.has(group.artist.trim().toLowerCase())) continue;
          const artistKey = group.artistId ?? group.artist.toLowerCase();
          if (seenArtists.has(artistKey) || seenGroups.has(group.id)) continue;
          seenArtists.add(artistKey);
          seenGroups.add(group.id);
          items.push(group);
          if (items.length >= 8) break;
        }
        if (items.length > 0) sections.push({ genre, items });
      } catch {
        failed += 1;
      }
    }

    if (topGenres.length > 0 && failed === topGenres.length) {
      set.status = 502;
      return { message: 'Discovery is temporarily unavailable. Try again.' };
    }

    return {
      basedOn: topGenres,
      sections,
      generatedAt: new Date().toISOString(),
    };
  },
);
