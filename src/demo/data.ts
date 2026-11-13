import type {
  AppSettings,
  ArtistDetail,
  ArtistReleaseGroup,
  ArtistSearchResult,
  DiscoverSection,
  FollowedArtist,
  Release,
  SavedSuggestion,
  SearchResult,
  WishlistItem,
} from '@/lib/types';
import catalog from './catalog.json';

const FORMATS = ['CD', 'Vinyl', 'Cassette'] as const;
const CONDITIONS = ['Mint', 'Near Mint', 'Very Good Plus', 'Very Good', 'Good'];
const LOCATIONS = [
  'Rough Trade, London',
  'Blue Note Milano, Milan',
  'Fnac, Milan',
  'Porta Portese, Rome',
  'Boomkat, Manchester',
  'Charity shop, Brighton',
  'Bandcamp',
  'Local record fair',
];
const PRICES = [12.9, 18.5, 9.9, 24, 16, 11.5, 29.9, 14.5];
const NOTES = [
  'Charity shop find, plays clean.',
  'Bought after a recommendation from a friend.',
  'Reissue with the original sleeve.',
  'A keeper. The first record I play on Sundays.',
  'Slight ring wear, vinyl is near mint.',
];

type CatalogTrack = {
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
  tracks: CatalogTrack[];
};

const OWNED = catalog.owned as CatalogAlbum[];
const WISHLIST_ALBUMS = catalog.wishlist as CatalogAlbum[];
const DISCOVER_ALBUMS = catalog.discover as CatalogAlbum[];

function monthsAgo(months: number, day: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, day));
}

function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function syntheticTracks(album: CatalogAlbum) {
  const count = 10;
  return Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    disc: null,
    number: index + 1,
    title: `${album.title} — Track ${index + 1}`,
    duration: 180 + ((index * 17) % 160),
    artist: album.artist,
  }));
}

function catalogTracks(album: CatalogAlbum) {
  return album.tracks.length >= 5 && album.tracks.length <= 30
    ? album.tracks
    : syntheticTracks(album);
}

function cover(album: CatalogAlbum): string | null {
  return album.coverUrl ?? null;
}

function buildReleases(): Release[] {
  return OWNED.map((album, index) => {
    const format = FORMATS[index % FORMATS.length];
    const tracks = catalogTracks(album);
    const hasPurchase = index % 6 !== 0;
    const createdAt = monthsAgo(23 - (index % 24), 1 + (index % 26));
    const releaseId = `demo-release-${String(index + 1).padStart(2, '0')}`;

    return {
      id: releaseId,
      musicbrainzId: album.releaseGroupId,
      title: album.title,
      artist: album.artist,
      artistId: album.artistId,
      year: album.year,
      releaseDate: album.releaseDate,
      country: album.country,
      label: album.label ?? 'Independent',
      catalogNumber: album.catalogNumber ?? `SLV-${String(index + 1).padStart(3, '0')}`,
      barcode: album.barcode,
      format,
      formatDetail: format === 'Vinyl' ? 'LP' : format,
      coverUrl: cover(album),
      notes: index % 3 === 0 ? NOTES[index % NOTES.length] : null,
      rating: index % 4 === 0 ? null : 1 + (index % 5),
      condition: index % 8 === 0 ? null : CONDITIONS[index % CONDITIONS.length],
      purchaseDate: hasPurchase
        ? dayString(monthsAgo(20 - (index % 18), 2 + (index % 25)))
        : null,
      purchaseLocation: hasPurchase ? LOCATIONS[index % LOCATIONS.length] : null,
      purchasePrice: hasPurchase ? PRICES[index % PRICES.length] : null,
      purchaseCurrency: hasPurchase ? 'EUR' : null,
      genres: album.genres.join(', '),
      trackCount: tracks.length,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      tracks: tracks.map((track, trackIndex) => ({
        id: `${releaseId}-track-${trackIndex + 1}`,
        releaseId,
        position: track.position,
        disc: track.disc,
        number: track.number,
        title: track.title,
        duration: track.duration,
        artist: track.artist,
      })),
    };
  });
}

function buildWishlist(): WishlistItem[] {
  return WISHLIST_ALBUMS.map((album, index) => {
    const format = FORMATS[(index + 1) % FORMATS.length];
    return {
      id: `demo-wish-${String(index + 1).padStart(2, '0')}`,
      musicbrainzId: null,
      releaseGroupId: album.releaseGroupId,
      title: album.title,
      artist: album.artist,
      artistId: album.artistId,
      year: album.year,
      releaseDate: album.releaseDate,
      country: album.country,
      label: album.label,
      catalogNumber: album.catalogNumber,
      barcode: album.barcode,
      format,
      formatDetail: format === 'Vinyl' ? 'LP' : format,
      coverUrl: cover(album),
      notes:
        index === 0
          ? 'Waiting for a clean copy at a fair price. The last two I found had worn sleeves and noisy vinyl, so I am holding out for a near mint pressing.'
          : index % 2 === 0
            ? 'Waiting for a clean copy at a fair price.'
            : null,
      targetPrice: 15 + index * 4,
      targetCurrency: 'EUR',
      createdAt: monthsAgo(10 - index, 4).toISOString(),
      updatedAt: monthsAgo(10 - index, 4).toISOString(),
    };
  });
}

function buildSaved(): SavedSuggestion[] {
  return DISCOVER_ALBUMS.slice(0, 4).map((album, index) => ({
    id: `demo-saved-${String(index + 1).padStart(2, '0')}`,
    releaseGroupId: album.releaseGroupId,
    title: album.title,
    artist: album.artist,
    artistId: album.artistId,
    year: album.year,
    releaseDate: album.releaseDate,
    coverUrl: album.coverUrl,
    type: album.type,
    createdAt: monthsAgo(4 - index, 7).toISOString(),
  }));
}

function buildFollows(): FollowedArtist[] {
  const seen = new Map<string, FollowedArtist>();
  for (const album of OWNED) {
    if (!album.artistId || seen.has(album.artistId)) continue;
    seen.set(album.artistId, {
      artistId: album.artistId,
      name: album.artist,
      createdAt: monthsAgo(12 - seen.size, 5).toISOString(),
      ownedCount: OWNED.filter((item) => item.artistId === album.artistId).length,
    });
    if (seen.size === 4) break;
  }
  return [...seen.values()];
}

export function buildDiscoverSections(): {
  featured: DiscoverSection['items'][number];
  sections: DiscoverSection[];
} {
  const items = DISCOVER_ALBUMS.map((album, index) => ({
    id: album.releaseGroupId,
    title: album.title,
    primaryType: album.type,
    secondaryTypes: [],
    firstReleaseDate: album.releaseDate,
    year: album.year,
    releaseCount: 1,
    coverUrl: album.coverUrl ?? '',
    artist: album.artist,
    artistId: album.artistId,
    score: 90 - index,
    reason:
      index < 4
        ? 'New from an artist near your shelf'
        : index < 9
          ? 'A recent record in a genre you collect'
          : 'An older record worth another look',
    genre: album.genres[0] ?? null,
  }));

  return {
    featured: items[0],
    sections: [
      {
        id: 'radar',
        kind: 'radar',
        title: 'From your artists',
        subtitle: 'New and recent records from artists in your library',
        items: items.slice(0, 4),
      },
      {
        id: 'new',
        kind: 'new',
        title: 'New this week',
        subtitle: 'Fresh releases across the genres you collect',
        items: items.slice(4, 9),
      },
      {
        id: 'crate',
        kind: 'crate',
        title: 'Lost in the Stacks',
        subtitle: 'Older albums that passed you by',
        items: items.slice(9),
      },
    ],
  };
}

function allAlbums(): CatalogAlbum[] {
  return [...OWNED, ...WISHLIST_ALBUMS, ...DISCOVER_ALBUMS];
}

export function buildSearchResults(): SearchResult[] {
  const seen = new Set<string>();
  return allAlbums()
    .filter((album) => {
      if (seen.has(album.releaseGroupId)) return false;
      seen.add(album.releaseGroupId);
      return true;
    })
    .map((album, index) => ({
      musicbrainzId: album.releaseGroupId,
      title: album.title,
      artist: album.artist,
      artistId: album.artistId,
      year: album.year,
      releaseDate: album.releaseDate,
      country: album.country,
      label: album.label,
      catalogNumber: album.catalogNumber,
      barcode: album.barcode,
      format: FORMATS[index % FORMATS.length],
      formatDetail: null,
      trackCount: album.tracks.length || 10,
      coverUrl: album.coverUrl ?? '',
      type: album.type,
    }));
}

export function buildArtistDetail(artistId: string): ArtistDetail {
  const albums = allAlbums();
  const artistAlbums = albums.filter((album) => album.artistId === artistId);
  const source = artistAlbums[0] ?? OWNED[0];
  const groups: ArtistReleaseGroup[] = artistAlbums.map((album) => ({
    id: album.releaseGroupId,
    title: album.title,
    primaryType: album.type,
    secondaryTypes: [],
    firstReleaseDate: album.releaseDate,
    year: album.year,
    releaseCount: 1,
    coverUrl: album.coverUrl ?? '',
    artist: album.artist,
    artistId: album.artistId,
  }));

  return {
    id: artistId,
    name: source?.artist ?? 'Demo Artist',
    sortName: source?.artist ?? 'Demo Artist',
    disambiguation: null,
    type: 'Group',
    country: source?.country ?? 'GB',
    area: 'United Kingdom',
    beginYear: source?.year ? source.year - 5 : 2010,
    endYear: null,
    ended: false,
    genres: [...new Set(artistAlbums.flatMap((album) => album.genres))],
    links: [
      { type: 'official homepage', url: 'https://example.com' },
      { type: 'bandcamp', url: 'https://example.com' },
    ],
    releaseGroups: groups,
    releaseGroupTotal: groups.length,
  };
}

export function buildArtistSearchResults(): ArtistSearchResult[] {
  const seen = new Map<string, ArtistSearchResult>();
  for (const album of allAlbums()) {
    if (!album.artistId || seen.has(album.artistId)) continue;
    seen.set(album.artistId, {
      id: album.artistId,
      name: album.artist,
      sortName: album.artist,
      disambiguation: null,
      type: 'Group',
      country: album.country ?? 'GB',
      area: 'United Kingdom',
      beginYear: album.year ? album.year - 5 : 2010,
      endYear: null,
      ended: false,
      score: 100 - seen.size,
    });
    if (seen.size === 6) break;
  }
  return [...seen.values()];
}

export type DemoState = {
  releases: Release[];
  wishlist: WishlistItem[];
  saved: SavedSuggestion[];
  follows: FollowedArtist[];
  settings: AppSettings;
};

export function createDemoState(): DemoState {
  return {
    releases: buildReleases(),
    wishlist: buildWishlist(),
    saved: buildSaved(),
    follows: buildFollows(),
    settings: {
      defaultFormat: 'CD',
      defaultCondition: 'Near Mint',
      defaultCurrency: 'EUR',
    },
  };
}
