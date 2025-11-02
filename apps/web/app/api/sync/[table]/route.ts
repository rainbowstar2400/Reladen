import { NextRequest, NextResponse } from 'next/server';
import { syncPayloadSchema } from '@/types';
import { SyncStore, type SyncEntity } from '../store';

export async function POST(
  _req: Request,
  { params }: { params: { table: string } }
) {
  // params.table で任意のテーブル名が取得できる。必要なら切り替え処理を追加。
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: { table: string } }
) {
  return NextResponse.json({ ok: true });
}
