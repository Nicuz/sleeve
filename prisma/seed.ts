import { prisma } from '../server/db';
import { getRelease, searchReleases } from '../server/musicbrainz';

type Seed = {
  artist: string;
  album: string;
  format: string;
  condition: string;
  rating: number;
  genres: string[];
  notes: string;
};

const seeds: Seed[] = [
  {
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    format: 'CD',
    condition: 'Near Mint',
    rating: 5,
    genres: ['Jazz', 'Modal'],
    notes: 'The mood-setter. Late-night default.',
  },
  {
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    format: 'Vinyl',
    condition: 'Very Good Plus',
    rating: 5,
    genres: ['Electronic', 'Disco', 'Funk'],
    notes: 'Sunday morning, volume up.',
  },
  {
    artist: 'Fleetwood Mac',
    album: 'Rumours',
    format: 'Vinyl',
    condition: 'Very Good',
    rating: 4,
    genres: ['Rock', 'Pop Rock'],
    notes: 'Inherited pressing with a few crackles.',
  },
  {
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    format: 'CD',
    condition: 'Near Mint',
    rating: 5,
    genres: ['Progressive Rock', 'Psychedelic Rock'],
    notes: 'The 30th anniversary edition.',
  },
  {
    artist: 'Michael Jackson',
    album: 'Thriller',
    format: 'Vinyl',
    condition: 'Good',
    rating: 4,
    genres: ['Pop', 'Funk', 'Soul'],
    notes: 'Sleeve worn, record plays clean.',
  },
  {
    artist: 'The Beatles',
    album: 'Abbey Road',
    format: 'Vinyl',
    condition: 'Near Mint',
    rating: 5,
    genres: ['Rock', 'Pop Rock'],
    notes: 'Reissue, half-speed mastered.',
  },
  {
    artist: 'John Coltrane',
    album: 'Blue Train',
    format: 'CD',
    condition: 'Very Good Plus',
    rating: 4,
    genres: ['Jazz', 'Hard Bop'],
    notes: 'Blue Note Rudy Van Gelder edition.',
  },
  {
    artist: 'Amy Winehouse',
    album: 'Back to Black',
    format: 'Vinyl',
    condition: 'Near Mint',
    rating: 5,
    genres: ['Soul', 'Rhythm and Blues'],
    notes: 'The one to put on when friends come over.',
  },
  {
    artist: 'The Smiths',
    album: 'The Queen Is Dead',
    format: 'CD',
    condition: 'Very Good',
    rating: 4,
    genres: ['Indie Rock', 'Post-Punk'],
    notes: 'A charity shop find.',
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function similarity(result: { title: string; artist: string }, seed: Seed) {
  const title = normalize(result.title);
  const album = normalize(seed.album);
  const artist = normalize(result.artist);
  const wanted = normalize(seed.artist);

  let score = 0;
  if (title === album) score += 6;
  else if (title.includes(album) || album.includes(title)) score += 4;
  if (artist === wanted) score += 5;
  else if (artist.includes(wanted) || wanted.includes(artist)) score += 3;
  return score;
}

async function main() {
  if (process.argv.includes('--reset')) {
    await prisma.track.deleteMany();
    await prisma.release.deleteMany();
    console.log('Cleared existing library.');
  }

  const existing = await prisma.release.findMany({
    select: { musicbrainzId: true },
  });
  const known = new Set(
    existing.map((item) => item.musicbrainzId).filter(Boolean) as string[],
  );

  for (const seed of seeds) {
    try {
      const query = `artist:"${seed.artist}" AND release:"${seed.album}" AND primarytype:album`;
      const results = await searchReleases(query, 15);
      if (!results.length) {
        console.warn(`No MusicBrainz match for “${seed.album}”`);
        continue;
      }

      const ranked = [...results].sort((a, b) => {
        const scoreA = similarity(a, seed) + (a.format === seed.format ? 2 : 0);
        const scoreB = similarity(b, seed) + (b.format === seed.format ? 2 : 0);
        return scoreB - scoreA;
      });
      const match = ranked[0];

      if (similarity(match, seed) < 6) {
        console.warn(
          `Weak match for “${seed.album}”: got “${match.title}” by ${match.artist}`,
        );
      }
      if (known.has(match.musicbrainzId)) {
        console.log(`Skipping “${match.title}” — already in library.`);
        continue;
      }

      const detail = await getRelease(match.musicbrainzId);
      const genres = [...detail.genres];
      for (const genre of seed.genres) {
        if (!genres.some((item) => item.toLowerCase() === genre.toLowerCase())) {
          genres.push(genre);
        }
      }
      await prisma.release.create({
        data: {
          musicbrainzId: detail.musicbrainzId,
          title: detail.title,
          artist: detail.artist,
          year: detail.year,
          releaseDate: detail.releaseDate,
          country: detail.country,
          label: detail.label,
          catalogNumber: detail.catalogNumber,
          barcode: detail.barcode,
          format: seed.format,
          formatDetail: detail.formatDetail,
          coverUrl: detail.coverUrl,
          notes: seed.notes,
          rating: seed.rating,
          condition: seed.condition,
          genres: genres.join(', '),
          trackCount: detail.trackCount,
          tracks: {
            create: detail.tracks.map((track) => ({
              position: track.position,
              disc: track.disc,
              number: track.number,
              title: track.title,
              duration: track.duration,
              artist: track.artist,
            })),
          },
        },
      });
      known.add(detail.musicbrainzId);
      console.log(
        `Added ${detail.title} — ${detail.artist} (${seed.format}, ${detail.year ?? 'n.d.'})`,
      );
    } catch (error) {
      console.warn(
        `Failed “${seed.album}”:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const total = await prisma.release.count();
  console.log(`\nLibrary now holds ${total} releases.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
