// apps/web/app/api/sync/[table]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 許可テーブル（ローカルDBの LocalTableName と対応）
const ALLOWED_TABLES = new Set([
  'residents',
  'relations',
  'feelings',
  'events',
  'topic_threads',
  'beliefs',
  'notifications',
] as const);

type AllowedTable = typeof ALLOWED_TABLES extends Set<infer U> ? U : never;

type SyncRequest = {
  since?: string | null;   // ISO (strict) or null
  limit?: number;          // 安全のため上限をかける
};

// Supabase クライアント（公開キーでも読み取りは可。必要なら Service Role に差し替え）
function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

/**
 * body: { since?: ISO | null, limit?: number }
 * res : { changes: any[] }
 */
export async function POST(
  req: Request,
  { params }: { params: { table: string } }
) {
  try {
    const tableParam = params?.table ?? '';
    if (!ALLOWED_TABLES.has(tableParam as AllowedTable)) {
      return NextResponse.json(
        { error: `table "${tableParam}" is not allowed` },
        { status: 400 }
      );
    }

    const sb = getSb();
    if (!sb) {
      return NextResponse.json(
        { error: 'Supabase client is not configured' },
        { status: 503 }
      );
    }

    // 入力バリデーション
    const json = (await req.json().catch(() => ({}))) as SyncRequest | undefined;
    const since = json?.since ?? null;
    const limit = Math.max(1, Math.min(1000, json?.limit ?? 500)); // デフォルト500, 上限1000

    // updated_at で差分取得
    // - Supabase 側テーブルはすべて updated_at と deleted を持つ前提
    // - since が無い場合は全件（上限あり）
    let q = sb.from(tableParam).select('*').order('updated_at', { ascending: true }).limit(limit);

    if (since) {
      // 厳密に since より新しいもの（同タイムスタンプ衝突を避ける）
      q = q.gt('updated_at', since);
    }

    const { data, error } = await q;
    if (error) {
      // 例: RLS による拒否やカラム名の不一致
      return NextResponse.json(
        { error: error.message ?? 'query failed' },
        { status: 500 }
      );
    }

    // 返却：ローカルの bulkUpsert でそのまま取り込めるよう raw を返す
    return NextResponse.json({ changes: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'unexpected error' },
      { status: 500 }
    );
  }
}

// CORS (必要なら有効化。外部呼び出し予定がなければ省略可)
export async function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}
