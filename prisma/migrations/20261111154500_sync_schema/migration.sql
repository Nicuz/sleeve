-- AlterTable
ALTER TABLE "WishlistItem" ADD COLUMN "releaseGroupId" TEXT;

-- CreateTable
CREATE TABLE "SavedSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseGroupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artistId" TEXT,
    "year" INTEGER,
    "releaseDate" TEXT,
    "coverUrl" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ArtistFollow" (
    "artistId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "defaultFormat" TEXT NOT NULL DEFAULT 'CD',
    "defaultCondition" TEXT NOT NULL DEFAULT 'Near Mint',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiscoveryFeed" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'current',
    "payload" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiscoverySeen" (
    "releaseGroupId" TEXT NOT NULL PRIMARY KEY,
    "artistId" TEXT,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DiscoveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseGroupId" TEXT NOT NULL,
    "artistId" TEXT,
    "artist" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedSuggestion_releaseGroupId_key" ON "SavedSuggestion"("releaseGroupId");

-- CreateIndex
CREATE INDEX "SavedSuggestion_createdAt_idx" ON "SavedSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "ArtistFollow_name_idx" ON "ArtistFollow"("name");

-- CreateIndex
CREATE INDEX "DiscoveryFeed_expiresAt_idx" ON "DiscoveryFeed"("expiresAt");

-- CreateIndex
CREATE INDEX "DiscoverySeen_seenAt_idx" ON "DiscoverySeen"("seenAt");

-- CreateIndex
CREATE INDEX "DiscoveryEvent_releaseGroupId_idx" ON "DiscoveryEvent"("releaseGroupId");

-- CreateIndex
CREATE INDEX "DiscoveryEvent_artistId_idx" ON "DiscoveryEvent"("artistId");

-- CreateIndex
CREATE INDEX "DiscoveryEvent_createdAt_idx" ON "DiscoveryEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_releaseGroupId_key" ON "WishlistItem"("releaseGroupId");

