import { describe, expect, it } from "vitest";
import { setPeekCacheEntry, shouldReusePeekCache, type PeekCacheMap } from "@/lib/peek/peek-cache";

describe("peek-cache", () => {
  it("同一住人は TTL 内ならキャッシュを再利用する", () => {
    const ttlMs = 30 * 60 * 1000;
    const now = 1_000_000;
    const cache = setPeekCacheEntry({} as PeekCacheMap, "A", {
      situation: "本を読んでいる",
      monologue: "静かな時間だな",
      fetchedAt: now - 10_000,
    });

    expect(shouldReusePeekCache(cache, "A", now, ttlMs)).toBe(true);
  });

  it("住人を切り替えた場合は別住人のキャッシュを再利用しない", () => {
    const ttlMs = 30 * 60 * 1000;
    const now = 1_000_000;
    const cacheA = setPeekCacheEntry({} as PeekCacheMap, "A", {
      situation: "窓際で空を見ている",
      monologue: "雲が流れていく",
      fetchedAt: now - 20_000,
    });
    const cacheAB = setPeekCacheEntry(cacheA, "B", {
      situation: "机でメモを整理している",
      monologue: "次の予定を確認しよう",
      fetchedAt: now - 5_000,
    });

    expect(shouldReusePeekCache(cacheAB, "A", now, ttlMs)).toBe(true);
    expect(shouldReusePeekCache(cacheAB, "B", now, ttlMs)).toBe(true);
    expect(shouldReusePeekCache(cacheAB, "C", now, ttlMs)).toBe(false);
  });

  it("TTL を超えたキャッシュは再利用しない", () => {
    const ttlMs = 30 * 60 * 1000;
    const now = 1_000_000;
    const cache = setPeekCacheEntry({} as PeekCacheMap, "A", {
      situation: "散歩している",
      monologue: "少し休もう",
      fetchedAt: now - ttlMs - 1,
    });

    expect(shouldReusePeekCache(cache, "A", now, ttlMs)).toBe(false);
  });
});
