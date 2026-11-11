export type Track = {
  id: string;
  releaseId: string;
  position: number;
  disc: number | null;
  number: number | null;
  title: string;
  duration: number | null;
  artist: string | null;
};

export type Release = {
  id: string;
  musicbrainzId: string | null;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  releaseDate: string | null;
  country: string | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  format: string;
  formatDetail: string | null;
  coverUrl: string | null;
  notes: string | null;
  rating: number | null;
  condition: string | null;
  purchaseDate: string | null;
  purchaseLocation: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  genres: string | null;
  trackCount: number | null;
  createdAt: string;
  updatedAt: string;
  tracks?: Track[];
};

export type GlobalSearchRelease = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  format: string;
  coverUrl: string | null;
  track: string | null;
};

export type GlobalSearchArtist = {
  name: string;
  artistId: string | null;
  count: number;
};

export type GlobalSearchWishlist = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  format: string;
  coverUrl: string | null;
};

export type GlobalSearchResponse = {
  query: string;
  releases: { items: GlobalSearchRelease[]; total: number };
  artists: { items: GlobalSearchArtist[]; total: number };
  wishlist: { items: GlobalSearchWishlist[]; total: number };
};

export type SearchResult = {
  musicbrainzId: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  releaseDate: string | null;
  country: string | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  format: string;
  formatDetail: string | null;
  trackCount: number | null;
  coverUrl: string;
  type: string | null;
};

export type MbRelease = SearchResult & {
  status: string | null;
  packaging: string | null;
  genres: string[];
  tracks: Array<{
    position: number;
    disc: number | null;
    number: number | null;
    title: string;
    duration: number | null;
    artist: string | null;
  }>;
};

export type ArtistSearchResult = {
  id: string;
  name: string;
  sortName: string | null;
  disambiguation: string | null;
  type: string | null;
  country: string | null;
  area: string | null;
  beginYear: number | null;
  endYear: number | null;
  ended: boolean;
  score: number;
};

export type ArtistLink = {
  type: string;
  url: string;
};

export type ArtistReleaseGroup = {
  id: string;
  title: string;
  primaryType: string;
  secondaryTypes: string[];
  firstReleaseDate: string | null;
  year: number | null;
  releaseCount: number;
  coverUrl: string;
  artist: string;
  artistId: string | null;
};

export type DiscoverReleaseGroup = ArtistReleaseGroup & {
  score: number;
};

export type DiscoveryItem = DiscoverReleaseGroup & {
  reason: string;
  genre: string | null;
};

export type DiscoverSectionKind = 'radar' | 'new' | 'crate';

export type DiscoverSection = {
  id: string;
  kind: DiscoverSectionKind;
  title: string;
  subtitle: string;
  items: DiscoveryItem[];
};

export type DiscoverResponse = {
  version: number;
  basedOn: string[];
  featured: DiscoveryItem | null;
  sections: DiscoverSection[];
  generatedAt: string;
  nextRefreshAt: string;
};

export type ArtistReleaseGroupsPage = {
  groups: ArtistReleaseGroup[];
  total: number;
};

export type ArtistDetail = Omit<ArtistSearchResult, 'score'> & {
  genres: string[];
  links: ArtistLink[];
  releaseGroups: ArtistReleaseGroup[];
  releaseGroupTotal: number;
};

export type EnrichResult = {
  status: 'matched' | 'unmatched' | 'duplicate';
  release?: Release;
  match?: { title: string; artist: string; score: number };
};

export type MetadataCacheInfo = {
  count: number;
  oldest: string | null;
  newest: string | null;
};

export type BackupFile = {
  name: string;
  bytes: number;
  createdAt: string;
};

export type ImportMode = 'merge' | 'replace';

export type ImportPreview = {
  mode: ImportMode;
  source: {
    app: string | null;
    version: number | null;
    exportedAt: string | null;
  };
  canReplace: boolean;
  incoming: {
    releases: number;
    tracks: number;
    wishlist: number;
    saved: number;
    follows: number;
    hasSettings: boolean;
  };
  importable: {
    releases: number;
    wishlist: number;
    saved: number;
    follows: number;
    hasSettings: boolean;
  };
  duplicates: {
    releases: number;
    wishlist: number;
    saved: number;
    follows: number;
  };
  invalid: {
    releases: number;
    wishlist: number;
    saved: number;
    follows: number;
    settings: number;
  };
  current: {
    releases: number;
    tracks: number;
    wishlist: number;
    saved: number;
    follows: number;
  };
  warnings: string[];
};

export type ImportResult = {
  mode: ImportMode;
  backup: BackupFile;
  importedReleases: number;
  skippedReleases: number;
  invalidReleases: number;
  importedWishlist: number;
  skippedWishlist: number;
  invalidWishlist: number;
  importedSaved: number;
  skippedSaved: number;
  invalidSaved: number;
  importedFollows: number;
  skippedFollows: number;
  invalidFollows: number;
  importedSettings: number;
  invalidSettings: number;
};

export type AppSettings = {
  defaultFormat: string;
  defaultCondition: string;
  defaultCurrency: string;
};

export type WishlistItem = {
  id: string;
  musicbrainzId: string | null;
  releaseGroupId: string | null;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  releaseDate: string | null;
  country: string | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  format: string;
  formatDetail: string | null;
  coverUrl: string | null;
  notes: string | null;
  targetPrice: number | null;
  targetCurrency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WishlistPayload = {
  musicbrainzId?: string | null;
  releaseGroupId?: string | null;
  title: string;
  artist: string;
  artistId?: string | null;
  year?: number | null;
  releaseDate?: string | null;
  country?: string | null;
  label?: string | null;
  catalogNumber?: string | null;
  barcode?: string | null;
  format: string;
  formatDetail?: string | null;
  coverUrl?: string | null;
  notes?: string | null;
  targetPrice?: number | null;
  targetCurrency?: string | null;
};

export type SavedSuggestion = {
  id: string;
  releaseGroupId: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  releaseDate: string | null;
  coverUrl: string | null;
  type: string;
  createdAt: string;
};

export type SavedSuggestionPayload = {
  releaseGroupId: string;
  title: string;
  artist: string;
  artistId?: string | null;
  year?: number | null;
  releaseDate?: string | null;
  coverUrl?: string | null;
  type: string;
};

export type FollowedArtist = {
  artistId: string;
  name: string;
  createdAt: string;
  ownedCount?: number;
};

export type StatsRange = 'all' | 'year' | '12m';

export type Stats = {
  total: number;
  missingMetadata: number;
  missingGenre: number;
  missingPurchaseInfo: number;
  totalTracks: number;
  totalArtists: number;
  totalGenres: number;
  delta: {
    releases: number;
    artists: number;
    tracks: number;
    genres: number;
  } | null;
  byFormat: Array<{ format: string; count: number }>;
  byDecade: Array<{ decade: string; value: number; count: number }>;
  topArtists: Array<{ artist: string; artistId?: string | null; count: number }>;
  topGenres: Array<{ genre: string; count: number }>;
  recentlyAdded: Release[];
};

export type Meta = {
  formats: string[];
  genres: string[];
  decades: number[];
};

export type SpendingStats = {
  currency: string;
  currencies: Array<{ currency: string; count: number; total: number }>;
  totalSpent: number;
  totalSpentDelta: number | null;
  releasesWithPrice: number;
  averagePrice: number | null;
  medianPrice: number | null;
  spentThisYear: number;
  currentYear: number;
  firstPurchaseYear: number | null;
  monthly: Array<{
    key: string;
    label: string;
    amount: number;
    count: number;
  }>;
  byFormat: Array<{ format: string; amount: number; count: number }>;
  topShops: Array<{ location: string; amount: number; count: number }>;
  mostExpensive: {
    id: string;
    title: string;
    artist: string;
    price: number;
    currency: string;
    purchaseDate: string | null;
  } | null;
  missingPurchaseInfo: number;
  purchaseDays: Array<{ date: string; count: number }>;
};

export type ReleasePayload = {
  musicbrainzId?: string | null;
  title: string;
  artist: string;
  artistId?: string | null;
  year?: number | null;
  releaseDate?: string | null;
  country?: string | null;
  label?: string | null;
  catalogNumber?: string | null;
  barcode?: string | null;
  format: string;
  formatDetail?: string | null;
  coverUrl?: string | null;
  notes?: string | null;
  rating?: number | null;
  condition?: string | null;
  purchaseDate?: string | null;
  purchaseLocation?: string | null;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  genres?: string[];
  trackCount?: number | null;
  tracks?: Array<{
    position?: number;
    disc?: number | null;
    number?: number | null;
    title: string;
    duration?: number | null;
    artist?: string | null;
  }>;
};
