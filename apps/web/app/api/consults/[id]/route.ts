// apps/web/app/api/consults/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * サーバー用の Supabase クライアント（Anonで読取のみ）
 * RLS で SELECT を許可しておく必要があります。
 */
function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false } });
}

/**
 * 既存UIが「ダミーと同じ形」で受け取れるよう、payload を正規化。
 * ここは“あなたのダミー構造”に合わせて調整してください（下記は代表例）。
 */
function normalizeConsultRow(row: any) {
  const p = row?.payload ?? {};

  // --- ダミー側のキーに合わせる（例） ---
  // ダミーが { id, title, content, choices?, updated_at } を想定しているケース
  return {
    id: row.id,
    title: p.title ?? p.subject ?? '相談',
    content: p.content ?? p.body ?? '',
    choices: Array.isArray(p.choices) ? p.choices : [],
    // 相談詳細にタイムスタンプを見せるなら：
    updated_at: row.updated_at,
    // 将来の拡張（必要ならUIが拾えるように置いておく）
    meta: p.meta ?? {},
  };
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = ctx?.params?.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const sb = getSb();
    if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

    // consult イベントを 1 件取得
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('kind', 'consult')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (!data) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    // ダミー互換の形に正規化して返す
    const consult = normalizeConsultRow(data);
    return NextResponse.json({ consult }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unexpected error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}
