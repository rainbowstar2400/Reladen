// apps/web/lib/evaluation/weights.ts
// ------------------------------------------------------------------
// 会話評価の重み表（外部JSON）を読み込み、メモリにキャッシュする。
// サーバ側：起動時に public/config/conversation-weights.json を同期読込。
// クライアント側：フォールバックとして既定のデフォルトを返す。
// ------------------------------------------------------------------

export type Impression =
  | 'none'
  | 'curious'
  | 'like?'
  | 'like'
  | 'dislike'
  | 'dislike?';

export type WeightsConfig = {
  tags: Record<string, number>;
  qualityHints: Record<string, number>;
  signals: Record<'continue' | 'close' | 'park', number>;
  favorClip: { min: number; max: number };
  impressionOrder: Impression[];
};

// ===== デフォルト（JSONが壊れても動く安全網） ================================
const DefaultWeights: WeightsConfig = {
  tags: {
    '共感': 0.6,
    '感謝': 0.7,
    '称賛': 0.8,
    '協力': 0.5,
    '否定': -0.8,
    '皮肉': -0.5,
    '非難': -1.2,
    '情報共有': 0.1,
    '軽い冗談': 0.2
  },
  qualityHints: {
    'coherence.good': 0.2,
    'coherence.poor': -0.4,
    'tone.gentle': 0.2,
    'tone.harsh': -0.4
  },
  signals: { continue: 0.1, close: 0.2, park: 0 },
  favorClip: { min: -2, max: 2 },
  impressionOrder: ['dislike', 'dislike?', 'none', 'curious', 'like?', 'like']
};

// ===== 共有ユーティリティ =====================================================
export function nextImpression(current: Impression, deltaSign: number, order?: Impression[]): Impression {
  const ladder = order && order.length >= 2 ? order : DefaultWeights.impressionOrder;
  if (deltaSign === 0) return current;
  const idx = ladder.indexOf(current);
  if (idx < 0) return current;
  if (deltaSign > 0) return ladder[Math.min(idx + 1, ladder.length - 1)];
  return ladder[Math.max(idx - 1, 0)];
}

export function clipFavor(x: number, clip?: { min: number; max: number }): number {
  const c = clip ?? DefaultWeights.favorClip;
  return Math.max(c.min, Math.min(c.max, x));
}

// ===== キャッシュとローダ =====================================================
let cached: WeightsConfig | null = null;
let triedServerLoad = false;

function isServer() {
  return typeof window === 'undefined';
}

function validate(partial: any): WeightsConfig | null {
  try {
    if (!partial || typeof partial !== 'object') return null;
    const w = partial as WeightsConfig;
    if (!w.tags || !w.qualityHints || !w.signals || !w.favorClip || !w.impressionOrder) return null;
    if (typeof w.favorClip.min !== 'number' || typeof w.favorClip.max !== 'number') return null;
    // signals キー検査（不足なら落とす）
    for (const k of ['continue', 'close', 'park'] as const) {
      if (typeof w.signals[k] !== 'number') return null;
    }
    // 基本十分
    return w;
  } catch {
    return null;
  }
}

// サーバ：同期読込（初回のみトライ）
function loadServerSync(): WeightsConfig | null {
  if (!isServer()) return null;
  if (triedServerLoad) return cached;
  triedServerLoad = true;

  try {
    // Next.js の作業ディレクトリはアプリルート想定
    const path = require('path');
    const fs = require('fs');
    const full = path.join(process.cwd(), 'public', 'config', 'conversation-weights.json');
    if (fs.existsSync(full)) {
      const raw = fs.readFileSync(full, 'utf-8');
      const parsed = JSON.parse(raw);
      const valid = validate(parsed);
      if (valid) {
        cached = valid;
        return cached;
      }
      console.warn('[weights] Invalid JSON schema. Fallback to defaults.');
    } else {
      console.warn('[weights] JSON not found. Fallback to defaults at:', full);
    }
  } catch (e) {
    console.warn('[weights] Failed to load JSON. Fallback to defaults.', e);
  }
  cached = DefaultWeights;
  return cached;
}

// 公開API：常に「何か」を返す（同期）
export function getWeightsCached(): WeightsConfig {
  if (cached) return cached;
  if (isServer()) {
    return loadServerSync() ?? DefaultWeights;
  }
  // クライアントはフォールバック
  cached = DefaultWeights;
  return cached;
}

// テスト用：重みの差し替え
export function __setWeightsForTests__(w: WeightsConfig) {
  cached = w;
}
