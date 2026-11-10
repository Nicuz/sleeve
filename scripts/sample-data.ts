const targetUrl = process.env.SAMPLE_DATABASE_URL ?? 'file:./sample.db';
process.env.DATABASE_URL = targetUrl;

const migrate = Bun.spawnSync(['bunx', 'prisma', 'migrate', 'deploy'], {
  env: process.env,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (migrate.exitCode !== 0) {
  console.error('Could not prepare the sample database.');
  process.exit(1);
}

const { prisma } = await import('../server/db');

const ARTISTS = [
  'Neon Harbor',
  'Velvet Static',
  'The Paper Moons',
  'Lena Marlow',
  'Cassette Ghosts',
  'Northbound',
  'Iris Vale',
  'Silver Arcade',
  'Echo District',
  'Mira Sol',
  'The Slow Waves',
  'Atlas Youth',
  'Golden Static',
  'Juniper Lane',
  'Midnight Transit',
  'Rosa FM',
  'The Quiet Machine',
  'Ocean State',
  'Luca Bloom',
  'Pale Signal',
];

const TITLES = [
  'Low Tide',
  'Neon Rooms',
  'Paper Cities',
  'Afterglow',
  'Static Bloom',
  'Northern Lights',
  'Velvet Hours',
  'Glass Avenue',
  'Night Bus',
  'Slow Motion',
  'Golden Hour',
  'Parallel Lines',
  'Soft Focus',
  'Electric Garden',
  'Blue Transit',
  'Warm Signal',
  'Empty Streets',
  'Summer Static',
  'Hidden Tracks',
  'Open Windows',
  'Out of Season',
  'Second Nature',
  'Low Frequency',
  'Bright Corners',
  'Quiet Riot',
  'Morning Drive',
  'Distant Rooms',
  'Analog Dreams',
  'Silver Lining',
  'New Waves',
  'Small Hours',
  'Daylight Saving',
  'Close to Home',
  'Endless Summer',
  'Inner Weather',
  'Highway Lights',
  'Paper Planes',
  'Local Time',
  'Slow Burn',
  'Red Sky',
  'Common Ground',
  'Easy Living',
  'Night Swimming',
  'First Light',
  'Lost Weekend',
  'Electric Blue',
  'City Lights',
  'Better Days',
  'Long Way Home',
  'Still Life',
  'Modern Love',
  'Low Season',
  'Sea Change',
  'Quiet Nights',
  'Bright Side',
  'Good Company',
  'Open Roads',
  'Fine Lines',
  'Late Bloom',
  'New Morning',
];

const COVER_COLORS = [
  ['#f4b860', '#7c4a12'],
  ['#ef7d5b', '#7a2d1c'],
  ['#7fb8f5', '#1e4d7c'],
  ['#b9d97c', '#3d5a16'],
  ['#c6a5ff', '#4b2a80'],
];

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sampleCover(title: string, artist: string, index: number): string {
  const [accent, ink] = COVER_COLORS[index % COVER_COLORS.length];
  const shortTitle = title.length > 22 ? `${title.slice(0, 21)}…` : title;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${ink}"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" fill="url(#g)"/>
  <circle cx="250" cy="205" r="130" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="2"/>
  <circle cx="250" cy="205" r="92" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2"/>
  <circle cx="250" cy="205" r="34" fill="#fff" fill-opacity="0.16"/>
  <text x="250" y="390" text-anchor="middle" font-family="Inter, sans-serif" font-size="30" font-weight="700" fill="#fff">${escapeXml(shortTitle)}</text>
  <text x="250" y="425" text-anchor="middle" font-family="Inter, sans-serif" font-size="17" letter-spacing="2" fill="#fff" fill-opacity="0.65">${escapeXml(artist.toUpperCase())}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const FORMATS = ['CD', 'Vinyl', 'Cassette', 'Digital', 'Other'];
const CONDITIONS = ['Mint', 'Near Mint', 'Very Good Plus', 'Very Good', 'Good', 'Fair'];
const GENRES = [
  ['Rock', 'Alternative Rock'],
  ['Pop', 'Pop Rock'],
  ['Jazz', 'Modal'],
  ['Electronic', 'Synthwave'],
  ['Hip Hop', 'Conscious Hip Hop'],
  ['Soul', 'Funk'],
  ['Folk', 'Singer-Songwriter'],
  ['Ambient', 'Downtempo'],
  ['Punk', 'Punk Rock'],
  ['Classical', 'Modern'],
  ['Soundtrack', 'Score'],
  ['R&B', 'Neo Soul'],
];
const LOCATIONS = [
  'Rough Trade, London',
  'Blue Note Milano, Milan',
  'Fnac, Milan',
  'Discoteca Laziale, Rome',
  'Porta Portese, Rome',
  'Boomkat, Manchester',
  'Charity shop, Brighton',
  'Bandcamp',
  'Local record fair',
  'Gift',
];
const CURRENCIES = ['EUR', 'USD', 'GBP'];

function dateMonthsAgo(monthsAgo: number, day: number): Date {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day),
  );
  return date;
}

function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fakeMbid(index: number): string {
  const a = String(index + 1).padStart(8, '0');
  const c = String(index + 1).padStart(12, '0');
  return `${a}-1111-4111-8111-${c.slice(0, 12)}`;
}

async function main() {
  await prisma.release.deleteMany({ where: { id: { startsWith: 'sample-' } } });
  await prisma.wishlistItem.deleteMany({
    where: { id: { startsWith: 'sample-wish-' } },
  });

  for (let index = 0; index < 60; index += 1) {
    const format = FORMATS[index % FORMATS.length];
    const artist = ARTISTS[index % ARTISTS.length];
    const title = TITLES[index];
    const genres = index % 9 === 0 ? null : GENRES[index % GENRES.length];
    const trackCount = index % 5 === 0 ? null : 8 + (index % 11);
    const hasPurchase = index % 6 !== 0;
    const purchaseDate = dateMonthsAgo(23 - (index % 24), 2 + (index % 25));
    const createdAt = dateMonthsAgo(23 - (index % 24), 1 + (index % 26));
    const price = 6.5 + ((index * 7) % 38);
    const rating = index % 4 === 0 ? null : 1 + (index % 5);

    await prisma.release.create({
      data: {
        id: `sample-${String(index + 1).padStart(2, '0')}`,
        musicbrainzId: index % 10 === 0 ? null : fakeMbid(index),
        title,
        artist,
        artistId: null,
        year: 1965 + ((index * 3) % 58),
        releaseDate: null,
        country: ['US', 'GB', 'DE', 'IT', 'FR', 'XE'][index % 6],
        label: ['Harbor Records', 'Static Tapes', 'Northline', 'Blue Room'][index % 4],
        catalogNumber: `SLV-${String(index + 1).padStart(3, '0')}`,
        barcode: null,
        format,
        formatDetail: format === 'Other' ? 'Special edition' : format,
        coverUrl: index % 4 === 0 ? null : sampleCover(title, artist, index),
        notes: index % 3 === 0 ? 'Sample note: charity shop find, plays clean.' : null,
        rating,
        condition: index % 8 === 0 ? null : CONDITIONS[index % CONDITIONS.length],
        purchaseDate: hasPurchase ? dayString(purchaseDate) : null,
        purchaseLocation: hasPurchase ? LOCATIONS[index % LOCATIONS.length] : null,
        purchasePrice: hasPurchase ? Math.round(price * 100) / 100 : null,
        purchaseCurrency: hasPurchase ? CURRENCIES[index % CURRENCIES.length] : null,
        genres: genres ? genres.join(', ') : null,
        trackCount,
        createdAt,
        tracks:
          trackCount === null
            ? undefined
            : {
                create: Array.from({ length: trackCount }, (_, trackIndex) => ({
                  position: trackIndex + 1,
                  disc: null,
                  number: trackIndex + 1,
                  title: `${title} — Track ${trackIndex + 1}`,
                  duration: 150 + ((index * 13 + trackIndex * 17) % 180),
                  artist,
                })),
              },
      },
    });

    if (index < 8) {
      await prisma.wishlistItem.create({
        data: {
          id: `sample-wish-${index + 1}`,
          musicbrainzId: null,
          title: TITLES[(index + 30) % TITLES.length],
          artist: ARTISTS[(index + 5) % ARTISTS.length],
          artistId: null,
          year: 1970 + ((index * 7) % 50),
          releaseDate: null,
          country: ['US', 'GB', 'DE', 'IT'][index % 4],
          label: 'Wishlist Records',
          catalogNumber: null,
          barcode: null,
          format: FORMATS[index % FORMATS.length],
          formatDetail: null,
          coverUrl:
            index % 3 === 0
              ? null
              : sampleCover(
                  TITLES[(index + 30) % TITLES.length],
                  ARTISTS[(index + 5) % ARTISTS.length],
                  index + 2,
                ),
          notes: index % 2 === 0 ? 'Sample wishlist note.' : null,
          targetPrice: index % 3 === 0 ? null : 12 + index * 3,
          targetCurrency: CURRENCIES[index % CURRENCIES.length],
        },
      });
    }
  }

  const releases = await prisma.release.count();
  const wishlist = await prisma.wishlistItem.count();
  console.log(`Sample data ready in ${targetUrl}`);
  console.log(`Releases: ${releases} · wishlist: ${wishlist}`);
  console.log('Run the app against it with:');
  console.log(`  DATABASE_URL="${targetUrl}" bun run dev`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
