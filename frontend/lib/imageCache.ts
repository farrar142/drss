// Image caching feature was removed (server no longer provides a cached URL).
// Keep no-op client helpers so callers can call these functions safely without
// performing network operations.

type CachedImageData = { url: string; width?: number; height?: number };

export async function getCachedImage(_url: string): Promise<CachedImageData | null> {
  return null;
}

export async function scheduleCachedImage(_url: string): Promise<void> {
  // no-op
  return;
}

export function clearCachedImage(_url: string) {
  // no-op
}

export function getCachedImageFromCache(_url: string): CachedImageData | null {
  return null;
}

export default { getCachedImage, clearCachedImage, getCachedImageFromCache };
