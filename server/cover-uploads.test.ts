import { describe, expect, test } from 'bun:test';
import { detectCoverImageType, isUploadCover, uploadCoverName } from './cover-uploads';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);

describe('detectCoverImageType', () => {
  test('recognises supported image headers', () => {
    expect(detectCoverImageType(PNG)?.ext).toBe('png');
    expect(detectCoverImageType(JPEG)?.contentType).toBe('image/jpeg');
    expect(detectCoverImageType(GIF)?.ext).toBe('gif');
    expect(detectCoverImageType(WEBP)?.ext).toBe('webp');
  });

  test('rejects other data', () => {
    expect(detectCoverImageType(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
  });
});

describe('upload cover references', () => {
  const name = `${'a'.repeat(64)}.webp`;

  test('accepts only well formed references', () => {
    expect(isUploadCover(`upload:${name}`)).toBe(true);
    expect(isUploadCover('https://coverartarchive.org/x')).toBe(false);
    expect(uploadCoverName(`upload:${name}`)).toBe(name);
    expect(uploadCoverName('upload:../secret.webp')).toBeNull();
    expect(uploadCoverName(`upload:${'a'.repeat(64)}.svg`)).toBeNull();
  });
});
