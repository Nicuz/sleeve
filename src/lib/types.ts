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

export type DiscoverSection = {
  genre: string;
  items: DiscoverReleaseGroup[];
};

export type DiscoverResponse = {
  basedOn: string[];
  sections: DiscoverSection[];
  generatedAt: string;
};

export type ArtistDetail = Omit<ArtistSearchResult, 'score'> & {
  genres: string[];
  links: ArtistLink[];
  releaseGroups: ArtistReleaseGroup[];
  releaseGroupTotal: number;
};


export type ImportResult = {
  importedReleases: number;
  skippedReleases: number;
  invalidReleases: number;
  importedWishlist: number;
  skippedWishlist: number;
  invalidWishlist: number;
};

export type WishlistItem = {
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
  priority: number;
  targetPrice: number | null;
  targetCurrency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WishlistPayload = {
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
  priority?: number;
  targetPrice?: number | null;
  targetCurrency?: string | null;
};

export type Stats = {
  total: number;
  totalTracks: number;
  totalArtists: number;
  totalGenres: number;
  byFormat: Array<{ format: string; count: number }>;
  byDecade: Array<{ decade: string; value: number; count: number }>;
  topArtists: Array<{ artist: string; count: number }>;
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
