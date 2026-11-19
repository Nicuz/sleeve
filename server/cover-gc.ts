import { prisma } from './db';
import {
  deleteCoverUpload,
  pruneUnusedCoverUploads,
  uploadCoverName,
} from './cover-uploads';

export async function pruneOrphanCoverUploads(
  minAgeMs = 60 * 60 * 1000,
): Promise<number> {
  const [releases, wishlist, saved] = await Promise.all([
    prisma.release.findMany({ select: { coverUrl: true } }),
    prisma.wishlistItem.findMany({ select: { coverUrl: true } }),
    prisma.savedSuggestion.findMany({ select: { coverUrl: true } }),
  ]);
  const referenced = new Set<string>();
  for (const row of [...releases, ...wishlist, ...saved]) {
    if (!row.coverUrl) continue;
    const name = uploadCoverName(row.coverUrl);
    if (name) referenced.add(name);
  }
  return pruneUnusedCoverUploads(referenced, minAgeMs);
}

export async function isCoverUploadReferenced(name: string): Promise<boolean> {
  const coverUrl = `upload:${name}`;
  const [releases, wishlist, saved] = await Promise.all([
    prisma.release.count({ where: { coverUrl } }),
    prisma.wishlistItem.count({ where: { coverUrl } }),
    prisma.savedSuggestion.count({ where: { coverUrl } }),
  ]);
  return releases + wishlist + saved > 0;
}

export async function deleteUnusedCoverUpload(name: string): Promise<boolean> {
  if (await isCoverUploadReferenced(name)) return false;
  await deleteCoverUpload(name);
  return true;
}
