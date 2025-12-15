import { feedsRoutersImageCacheImageGet, feedsRoutersImageCacheImagePost } from '@/app/services/api';

type CachedImageData = { url: string; width?: number; height?: number };

const cache = new Map<string, { status: 'pending' | 'done'; promise?: Promise<CachedImageData | null>; data?: CachedImageData }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getCachedImage(url: string): Promise<CachedImageData | null> {
  // return done
  const existing = cache.get(url);
  if (existing) {
    if (existing.status === 'done') return existing.data!;
    if (existing.promise) return existing.promise;
  }

  const promise = (async () => {
    try {
      // First, request scheduling (POST). If it returns a url immediately, return it.
      const postRes = await feedsRoutersImageCacheImagePost({ url }).catch(() => null) as any;
      if (postRes && postRes.url) {
        const d: CachedImageData = { url: postRes.url, width: postRes.width, height: postRes.height };
        cache.set(url, { status: 'done', data: d });
        return d;
      }

      // Otherwise, poll GET until URL is available, with exponential backoff
      let delay = 700;
      for (let attempt = 0; attempt < 8; attempt++) {
        await sleep(delay);
        const getRes = await feedsRoutersImageCacheImageGet({ url }).catch(() => null) as any;
        if (getRes && getRes.url) {
          const d: CachedImageData = { url: getRes.url, width: getRes.width, height: getRes.height };
          cache.set(url, { status: 'done', data: d });
          return d;
        }
        delay = Math.min(5000, delay * 1.8);
      }

      // Not available
      cache.delete(url);
      return null;
    } catch (e) {
      cache.delete(url);
      return null;
    }
  })();

  cache.set(url, { status: 'pending', promise });
  return promise;
}

// Fire-and-forget schedule request to cache an image. If the POST returns an immediate
// url, populate the in-memory cache so callers can pick it up.
export async function scheduleCachedImage(url: string): Promise<void> {
  try {
    const postRes = await feedsRoutersImageCacheImagePost({ url }).catch(() => null) as any;
    if (postRes && postRes.url) {
      const d: CachedImageData = { url: postRes.url, width: postRes.width, height: postRes.height };
      cache.set(url, { status: 'done', data: d });
    }
  } catch (e) {
    // ignore
  }
}

export function clearCachedImage(url: string) {
  cache.delete(url);
}

export function getCachedImageFromCache(url: string): CachedImageData | null {
  const e = cache.get(url);
  return e && e.status === 'done' ? e.data! : null;
}

export default { getCachedImage, clearCachedImage, getCachedImageFromCache };
