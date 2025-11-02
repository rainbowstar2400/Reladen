import { NextRequest, NextResponse } from 'next/server';
import { syncPayloadSchema } from '@/types';
import { SyncStore, type SyncEntity } from '../store';

// POST: 差分を受け取り、サーバー側の更新データを返す
export async function POST(
  req: NextRequest,
  { params }: { params: { table: string } }
) {
  const { table } = params;
  // リクエストボディのJSONを取得
  const body = await req.json().catch(() => ({}));
  // クライアントからのchangesやsinceをそのまま使える場合は使う（今回は空返し）
  const since = body.since as string | undefined;

  // TODO: Supabase などから `since` 以降に更新されたデータを取得し、changesに詰める
  const changes: { data: SyncEntity; updated_at: string; deleted?: boolean }[] = [];

  // 期待されるスキーマ形式で返却する
  return NextResponse.json({
    table,
    changes,
    since,
  });
}

// GET: 単純に空の差分を返す（必要ならsinceをクエリで受け取る）
export async function GET(
  req: NextRequest,
  { params }: { params: { table: string } }
) {
  const { table } = params;
  const since = req.nextUrl.searchParams.get('since') ?? undefined;
  return NextResponse.json({
    table,
    changes: [],
    since,
  });
}
