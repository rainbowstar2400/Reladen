export type PeekCacheEntry = {
  situation: string;
  monologue: string;
  fetchedAt: number;
};

export type PeekCacheMap = Record<string, PeekCacheEntry>;

export function shouldReusePeekCache(
  cache: PeekCacheMap,
  residentId: string | null,
  nowMs: number,
  ttlMs: number,
): boolean {
  if (!residentId) return false;
  const hit = cache[residentId];
  if (!hit) return false;
  return nowMs - hit.fetchedAt < ttlMs;
}

export function setPeekCacheEntry(
  cache: PeekCacheMap,
  residentId: string,
  entry: PeekCacheEntry,
): PeekCacheMap {
  return {
    ...cache,
    [residentId]: entry,
  };
}
