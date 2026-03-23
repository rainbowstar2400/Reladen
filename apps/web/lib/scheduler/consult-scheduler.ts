// apps/web/lib/scheduler/consult-scheduler.ts
// 相談の「自動発火」を行うクライアント側スケジューラー。
// - マルチタブ重複を localStorage ロックで抑止（TTL 付き）
// - ジッター付きインターバルで相談生成 API を定期呼び出し

import { listLocal } from "@/lib/db-local";

// --- 定数 ---
const LOCK_KEY = "reladen:consult-scheduler:lock";
const LOCK_TTL_MS = 60_000;
const LAST_RUN_KEY = "reladen:consult-scheduler:last-run";
const DAILY_CONSULT_KEY_PREFIX = "reladen:consult-daily:";

const BASE_INTERVAL_MS = 45 * 60 * 1000; // 45分（30-60分の中央）
const FIRST_CHECK_DELAY_MS = 3_000; // 初回は3秒後

// --- localStorage ヘルパー ---
function nowTs() { return Date.now(); }
function readLs(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const ts = Number(v);
    return Number.isFinite(ts) ? ts : null;
  } catch { return null; }
}
function writeLs(key: string, ts: number) {
  try { localStorage.setItem(key, String(ts)); } catch { /* ignore */ }
}
function clearLs(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function tryAcquireLock(): boolean {
  const ts = readLs(LOCK_KEY);
  const t = nowTs();
  if (ts && t - ts < LOCK_TTL_MS) return false;
  writeLs(LOCK_KEY, t);
  return true;
}
function refreshLock() { writeLs(LOCK_KEY, nowTs()); }
function clearLock() { clearLs(LOCK_KEY); }

function hasRecentRun(): boolean {
  const last = readLs(LAST_RUN_KEY);
  if (!last) return false;
  return nowTs() - last < BASE_INTERVAL_MS * 0.8;
}
function markRun() { writeLs(LAST_RUN_KEY, nowTs()); }

// --- ジッター ---
function jitter(base: number) {
  const r = 1 + (Math.random() * 0.4 - 0.2); // ±20%
  return Math.max(10_000, Math.floor(base * r));
}

// --- 1日1回制限チェック ---
function hasDailyConsult(residentId: string): boolean {
  const key = DAILY_CONSULT_KEY_PREFIX + residentId;
  const ts = readLs(key);
  if (!ts) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return ts >= todayStart.getTime();
}
function markDailyConsult(residentId: string) {
  const key = DAILY_CONSULT_KEY_PREFIX + residentId;
  writeLs(key, nowTs());
}

// --- 抽選と API 呼び出し ---
async function runConsultCheck(): Promise<void> {
  // 75% 確率チェック
  if (Math.random() > 0.75) return;

  // 全住人取得
  const residents = ((await listLocal("residents")) as any[]) ?? [];
  const activeResidents = residents.filter((r) => !r.deleted);
  if (activeResidents.length === 0) return;

  // 未処理の relation_trigger を検索（最優先）
  const events = ((await listLocal("events")) as any[]) ?? [];
  const triggers = events.filter(
    (e) => e.kind === "relation_trigger" && !e.deleted && !e.payload?.handled,
  );

  // クールダウン中のペアを取得
  const cooldowns = events.filter(
    (e) => e.kind === "consult_cooldown" && !e.deleted,
  );
  const activeCooldowns = cooldowns.filter(
    (c) => new Date(c.payload?.expiresAt ?? 0).getTime() > nowTs(),
  );
  const cooldownPairs = new Set(activeCooldowns.map((c) => c.payload?.pair));

  let targetResidentId: string | null = null;
  let triggerId: string | undefined;

  if (triggers.length > 0) {
    // 関係遷移トリガーを優先
    for (const t of triggers) {
      const participants = Array.isArray(t.payload?.participants) ? t.payload.participants : [];
      const pair = [...participants].sort().join(":");
      if (cooldownPairs.has(pair)) continue;

      const residentId = typeof t.payload?.residentId === "string" ? t.payload.residentId : null;
      if (residentId && !hasDailyConsult(residentId)) {
        targetResidentId = residentId;
        triggerId = t.id;
        break;
      }
    }
  }

  if (!targetResidentId) {
    // 通常抽選
    const { calcConsultWeight } = await import("@repo/shared/logic/consult");

    const candidates = activeResidents
      .filter((r) => !hasDailyConsult(r.id))
      .map((r) => {
        const trust = r.trustToPlayer ?? r.trust_to_player ?? 50;
        const traits = r.traits ?? {};
        const weight = calcConsultWeight({
          trust,
          traits: {
            sociability: traits.sociability ?? 3,
            empathy: traits.empathy ?? 3,
            stubbornness: traits.stubbornness ?? 3,
          },
        });
        return { id: r.id, weight };
      })
      .filter((c) => c.weight > 0);

    if (candidates.length === 0) return;

    // 加重ランダム
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * totalWeight;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) {
        targetResidentId = c.id;
        break;
      }
    }
    if (!targetResidentId) targetResidentId = candidates[candidates.length - 1].id;
  }

  if (!targetResidentId) return;

  // API 呼び出し
  try {
    const res = await fetch("/api/consults/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ residentId: targetResidentId, triggerId }),
    });

    if (res.ok) {
      markDailyConsult(targetResidentId);
      // 同期リクエストを発火して IndexedDB → UI に反映
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("reladen:request-sync"));
      }
    }
  } catch (error) {
    console.warn("[ConsultScheduler] API call failed", error);
  }
}

// --- メインスケジューラー ---
export function startConsultScheduler(): { stop: () => void } {
  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  async function tick() {
    if (stopped) return;
    if (!tryAcquireLock()) {
      schedule();
      return;
    }
    if (hasRecentRun()) {
      clearLock();
      schedule();
      return;
    }

    try {
      refreshLock();
      await runConsultCheck();
      markRun();
    } catch (error) {
      console.warn("[ConsultScheduler] tick error", error);
    } finally {
      clearLock();
      if (!stopped) schedule();
    }
  }

  function schedule() {
    timerId = setTimeout(tick, jitter(BASE_INTERVAL_MS));
  }

  // 初回は即座に（少し遅延後）
  timerId = setTimeout(tick, FIRST_CHECK_DELAY_MS);

  return {
    stop() {
      stopped = true;
      if (timerId) clearTimeout(timerId);
    },
  };
}
