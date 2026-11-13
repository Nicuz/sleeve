const USER_AGENT = 'SleeveDemo/0.1 ( https://github.com/Nicuz/sleeve )';

type Spec = {
  title: string;
  artist: string;
  genres: string[];
  tracks?: number;
};

type TrackSeed = {
  position: number;
  disc: number | null;
  number: number | null;
  title: string;
  duration: number | null;
  artist: string | null;
};

type CatalogAlbum = {
  title: string;
  artist: string;
  artistId: string;
  releaseGroupId: string;
  coverUrl: string | null;
  year: number | null;
  releaseDate: string | null;
  country: string | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  format: string;
  type: string;
  genres: string[];
  tracks: TrackSeed[];
};

const OWNED: Spec[] = [
  { title: 'Kind of Blue', tracks: 5, artist: 'Miles Davis', genres: ['Jazz', 'Modal'] },
  {
    title: 'Random Access Memories',
    tracks: 13,
    artist: 'Daft Punk',
    genres: ['Electronic', 'Disco'],
  },
  { title: 'Rumours', tracks: 11, artist: 'Fleetwood Mac', genres: ['Rock', 'Pop Rock'] },
  {
    title: 'The Dark Side of the Moon',
    tracks: 10,
    artist: 'Pink Floyd',
    genres: ['Progressive Rock', 'Psychedelic Rock'],
  },
  { title: 'Thriller', tracks: 9, artist: 'Michael Jackson', genres: ['Pop', 'Funk'] },
  {
    title: 'Abbey Road',
    tracks: 17,
    artist: 'The Beatles',
    genres: ['Rock', 'Pop Rock'],
  },
  {
    title: 'Blue Train',
    tracks: 5,
    artist: 'John Coltrane',
    genres: ['Jazz', 'Hard Bop'],
  },
  {
    title: 'Back to Black',
    tracks: 11,
    artist: 'Amy Winehouse',
    genres: ['Soul', 'R&B'],
  },
  {
    title: 'OK Computer',
    tracks: 12,
    artist: 'Radiohead',
    genres: ['Alternative Rock', 'Art Rock'],
  },
  {
    title: 'The Queen Is Dead',
    tracks: 10,
    artist: 'The Smiths',
    genres: ['Indie Rock', 'Post-Punk'],
  },
  { title: 'Purple Rain', tracks: 9, artist: 'Prince', genres: ['Pop', 'Funk'] },
  {
    title: 'Songs in the Key of Life',
    tracks: 21,
    artist: 'Stevie Wonder',
    genres: ['Soul', 'Funk'],
  },
  { title: 'Homogenic', tracks: 10, artist: 'Björk', genres: ['Electronic', 'Art Pop'] },
  {
    title: 'Discovery',
    tracks: 14,
    artist: 'Daft Punk',
    genres: ['Electronic', 'House'],
  },
  {
    title: 'In Rainbows',
    tracks: 10,
    artist: 'Radiohead',
    genres: ['Alternative Rock', 'Art Rock'],
  },
  {
    title: 'Currents',
    tracks: 13,
    artist: 'Tame Impala',
    genres: ['Psychedelic Pop', 'Synthpop'],
  },
  {
    title: 'Blonde',
    tracks: 17,
    artist: 'Frank Ocean',
    genres: ['R&B', 'Alternative R&B'],
  },
  {
    title: 'The Suburbs',
    tracks: 16,
    artist: 'Arcade Fire',
    genres: ['Indie Rock', 'Baroque Pop'],
  },
  {
    title: 'Master of Puppets',
    tracks: 8,
    artist: 'Metallica',
    genres: ['Thrash Metal'],
  },
  {
    title: 'Enter the Wu-Tang (36 Chambers)',
    tracks: 12,
    artist: 'Wu-Tang Clan',
    genres: ['Hip Hop', 'Boom Bap'],
  },
  {
    title: 'The Miseducation of Lauryn Hill',
    tracks: 16,
    artist: 'Lauryn Hill',
    genres: ['Hip Hop', 'Neo Soul'],
  },
  {
    title: 'Is This It',
    tracks: 11,
    artist: 'The Strokes',
    genres: ['Indie Rock', 'Garage Rock'],
  },
  { title: 'Untrue', tracks: 13, artist: 'Burial', genres: ['Electronic', 'Dubstep'] },
  {
    title: 'Selected Ambient Works 85-92',
    tracks: 13,
    artist: 'Aphex Twin',
    genres: ['Ambient', 'IDM'],
  },
];

const WISHLIST: Spec[] = [
  { title: 'Pastel Blues', artist: 'Nina Simone', genres: ['Jazz', 'Soul'] },
  { title: 'Diamond Life', artist: 'Sade', genres: ['Soul', 'Smooth Jazz'] },
  {
    title: 'Mezzanine',
    artist: 'Massive Attack',
    genres: ['Trip Hop', 'Electronic'],
  },
  { title: 'Blue', artist: 'Joni Mitchell', genres: ['Folk', 'Singer-Songwriter'] },
  { title: 'Tapestry', artist: 'Carole King', genres: ['Folk', 'Singer-Songwriter'] },
  { title: 'Dummy', artist: 'Portishead', genres: ['Trip Hop', 'Electronic'] },
];

const DISCOVER: Spec[] = [
  {
    title: 'Sometimes I Might Be Introvert',
    artist: 'Little Simz',
    genres: ['Hip Hop', 'Conscious Hip Hop'],
  },
  {
    title: 'Dragon New Warm Mountain I Believe in You',
    artist: 'Big Thief',
    genres: ['Indie Folk', 'Alternative Rock'],
  },
  {
    title: "What's Your Pleasure?",
    artist: 'Jessie Ware',
    genres: ['Disco', 'Pop'],
  },
  {
    title: 'Promises',
    artist: 'Floating Points',
    genres: ['Jazz', 'Ambient'],
  },
  {
    title: 'Jubilee',
    artist: 'Japanese Breakfast',
    genres: ['Indie Pop', 'Dream Pop'],
  },
  {
    title: 'Ants From Up There',
    artist: 'Black Country, New Road',
    genres: ['Post-Rock', 'Art Rock'],
  },
  { title: 'Blue Rev', artist: 'Alvvays', genres: ['Indie Pop', 'Shoegaze'] },
  {
    title: 'Natural Brown Prom Queen',
    artist: 'Sudan Archives',
    genres: ['Alternative R&B', 'Experimental'],
  },
  { title: 'Wet Leg', artist: 'Wet Leg', genres: ['Indie Rock', 'Post-Punk'] },
  {
    title: 'Topical Dancer',
    artist: 'Charlotte Adigéry & Bolis Pupul',
    genres: ['Electronic', 'Art Pop'],
  },
  { title: 'Diaspora Problems', artist: 'Soul Glo', genres: ['Hardcore', 'Punk'] },
  {
    title:
      'Praise a Lord Who Chews but Which Does Not Consume; (Or Simply, Hot Between Worlds)',
    artist: 'Yves Tumor',
    genres: ['Art Rock', 'Neo-Psychedelia'],
  },
  { title: 'Renaissance', artist: 'Beyoncé', genres: ['Pop', 'Dance'] },
  {
    title: 'Fetch the Bolt Cutters',
    artist: 'Fiona Apple',
    genres: ['Art Pop', 'Singer-Songwriter'],
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mb<T>(url: string): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await sleep(attempt === 1 ? 1400 : 5000 * attempt);
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (response.ok) return (await response.json()) as T;
    if (response.status !== 429 && response.status !== 503) {
      throw new Error(`MusicBrainz ${response.status}: ${url}`);
    }
    console.error(`MusicBrainz ${response.status}, retry ${attempt}/4`);
  }
  throw new Error(`MusicBrainz unavailable: ${url}`);
}

async function resolveCover(releaseGroupId: string): Promise<string | null> {
  await sleep(250);
  try {
    const response = await fetch(
      `https://coverartarchive.org/release-group/${releaseGroupId}/front-500`,
      {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT },
      },
    );
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    return type.startsWith('image/') ? response.url : null;
  } catch {
    return null;
  }
}

async function resolveReleaseCover(releaseId: string): Promise<string | null> {
  await sleep(250);
  try {
    const response = await fetch(
      `https://coverartarchive.org/release/${releaseId}/front-500`,
      {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT },
      },
    );
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    return type.startsWith('image/') ? response.url : null;
  } catch {
    return null;
  }
}

type MbArtistCredit = {
  name: string;
  artist: { id: string; name: string };
};

type MbReleaseGroup = {
  id: string;
  title: string;
  'primary-type': string | null;
  'first-release-date': string | null;
  'artist-credit': MbArtistCredit[];
};

type MbTrack = {
  position: number;
  number: string;
  title: string;
  length: number | null;
  'artist-credit'?: MbArtistCredit[];
};

type MbMedium = {
  position: number;
  format: string | null;
  track?: MbTrack[];
  tracks?: MbTrack[];
};

type MbRelease = {
  id: string;
  title: string;
  date: string | null;
  country: string | null;
  barcode: string | null;
  status: string | null;
  media: MbMedium[];
  'label-info': Array<{ 'catalog-number': string | null; label?: { name: string } }>;
};
function normalizeFormat(value: string | null): string | null {
  if (!value) return null;
  const format = value.toLowerCase();
  if (format.includes('cd')) return 'CD';
  if (format.includes('vinyl') || format.includes('lp')) return 'Vinyl';
  if (format.includes('cassette')) return 'Cassette';
  return null;
}

async function releaseGroup(spec: Spec): Promise<MbReleaseGroup> {
  const query = `releasegroup:"${spec.title}" AND artist:"${spec.artist}"`;
  const data = await mb<{ 'release-groups': MbReleaseGroup[] }>(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
  );
  const group =
    data['release-groups'].find(
      (item) =>
        item.title.toLowerCase().replace(/[^a-z0-9]/g, '') ===
        spec.title.toLowerCase().replace(/[^a-z0-9]/g, ''),
    ) ?? data['release-groups'][0];
  if (!group) throw new Error(`No release group for ${spec.title}`);
  return group;
}

async function ownedAlbum(spec: Spec): Promise<CatalogAlbum> {
  const group = await releaseGroup(spec);
  const releases = await mb<{ releases: MbRelease[] }>(
    `https://musicbrainz.org/ws/2/release?release-group=${group.id}&inc=recordings+labels&fmt=json&limit=25`,
  );
  const trackTotal = (release: MbRelease) =>
    release.media.reduce(
      (sum, item) => sum + (item.tracks ?? item.track ?? []).length,
      0,
    );
  const candidates = releases.releases
    .filter(
      (release) =>
        release.status === 'Official' &&
        trackTotal(release) > 0 &&
        trackTotal(release) <= 40,
    )
    .sort((a, b) => {
      if (spec.tracks) {
        return (
          Math.abs(trackTotal(a) - spec.tracks) - Math.abs(trackTotal(b) - spec.tracks)
        );
      }
      return trackTotal(b) - trackTotal(a);
    });
  const release = candidates[0] ?? releases.releases[0];
  if (!release) throw new Error(`No release for ${spec.title}`);

  const medium =
    release.media.find((item) => normalizeFormat(item.format)) ?? release.media[0];
  const format = normalizeFormat(medium?.format ?? null) ?? 'CD';
  const tracks = release.media.flatMap((item) =>
    (item.tracks ?? item.track ?? []).map((track) => ({
      position: track.position,
      disc: release.media.length > 1 ? item.position : null,
      number: Number(track.number) || track.position,
      title: track.title,
      duration: track.length ? Math.round(track.length / 1000) : null,
      artist:
        track['artist-credit']?.map((credit) => credit.name).join('') ??
        group['artist-credit'].map((credit) => credit.name).join('') ??
        spec.artist,
    })),
  );
  const labelInfo = release['label-info'][0];
  const artistCredit = group['artist-credit'][0];

  return {
    title: group.title,
    artist: artistCredit?.name ?? spec.artist,
    artistId: artistCredit?.artist.id ?? '',
    releaseGroupId: group.id,
    coverUrl: (await resolveCover(group.id)) ?? (await resolveReleaseCover(release.id)),
    year: group['first-release-date']
      ? Number(group['first-release-date'].slice(0, 4))
      : null,
    releaseDate: group['first-release-date'],
    country: release.country,
    label: labelInfo?.label?.name ?? null,
    catalogNumber: labelInfo?.['catalog-number'] ?? null,
    barcode: release.barcode,
    format,
    type: group['primary-type'] ?? 'Album',
    genres: spec.genres,
    tracks,
  };
}

async function groupOnlyAlbum(spec: Spec): Promise<CatalogAlbum> {
  const group = await releaseGroup(spec);
  const artistCredit = group['artist-credit'][0];
  return {
    title: group.title,
    artist: artistCredit?.name ?? spec.artist,
    artistId: artistCredit?.artist.id ?? '',
    releaseGroupId: group.id,
    coverUrl: await resolveCover(group.id),
    year: group['first-release-date']
      ? Number(group['first-release-date'].slice(0, 4))
      : null,
    releaseDate: group['first-release-date'],
    country: null,
    label: null,
    catalogNumber: null,
    barcode: null,
    format: 'CD',
    type: group['primary-type'] ?? 'Album',
    genres: spec.genres,
    tracks: [],
  };
}

async function mapLimited<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (const [index, item] of items.entries()) {
    try {
      results.push(await fn(item, index));
      console.error(`ok ${index + 1}/${items.length}`);
    } catch (error) {
      console.error(`failed ${index + 1}/${items.length}:`, error);
    }
  }
  return results;
}

const owned = await mapLimited(OWNED, ownedAlbum);
const wishlist = await mapLimited(WISHLIST, groupOnlyAlbum);
const discover = await mapLimited(DISCOVER, groupOnlyAlbum);

const catalog = { owned, wishlist, discover };
await Bun.write('src/demo/catalog.json', `${JSON.stringify(catalog, null, 2)}\n`);
console.log(
  `Wrote ${owned.length} owned, ${wishlist.length} wishlist, ${discover.length} discover albums.`,
);
