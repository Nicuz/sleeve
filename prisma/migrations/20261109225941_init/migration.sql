-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "musicbrainzId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artistId" TEXT,
    "year" INTEGER,
    "releaseDate" TEXT,
    "country" TEXT,
    "label" TEXT,
    "catalogNumber" TEXT,
    "barcode" TEXT,
    "format" TEXT NOT NULL,
    "formatDetail" TEXT,
    "coverUrl" TEXT,
    "notes" TEXT,
    "rating" INTEGER,
    "condition" TEXT,
    "purchaseDate" TEXT,
    "purchaseLocation" TEXT,
    "purchasePrice" REAL,
    "purchaseCurrency" TEXT,
    "genres" TEXT,
    "trackCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "musicbrainzId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artistId" TEXT,
    "year" INTEGER,
    "releaseDate" TEXT,
    "country" TEXT,
    "label" TEXT,
    "catalogNumber" TEXT,
    "barcode" TEXT,
    "format" TEXT NOT NULL,
    "formatDetail" TEXT,
    "coverUrl" TEXT,
    "notes" TEXT,
    "targetPrice" REAL,
    "targetCurrency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetadataCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "disc" INTEGER,
    "number" INTEGER,
    "title" TEXT NOT NULL,
    "duration" INTEGER,
    "artist" TEXT,
    CONSTRAINT "Track_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Release_musicbrainzId_key" ON "Release"("musicbrainzId");

-- CreateIndex
CREATE INDEX "Release_artist_idx" ON "Release"("artist");

-- CreateIndex
CREATE INDEX "Release_format_idx" ON "Release"("format");

-- CreateIndex
CREATE INDEX "Release_year_idx" ON "Release"("year");

-- CreateIndex
CREATE INDEX "Release_createdAt_idx" ON "Release"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_musicbrainzId_key" ON "WishlistItem"("musicbrainzId");

-- CreateIndex
CREATE INDEX "WishlistItem_createdAt_idx" ON "WishlistItem"("createdAt");

-- CreateIndex
CREATE INDEX "MetadataCache_expiresAt_idx" ON "MetadataCache"("expiresAt");

-- CreateIndex
CREATE INDEX "Track_releaseId_idx" ON "Track"("releaseId");

