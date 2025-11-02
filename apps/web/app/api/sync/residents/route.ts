import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: 同期処理
  return NextResponse.json({ ok: true });
}

// GET も許可するなら
export async function GET() {
  return NextResponse.json({ ok: true });
}