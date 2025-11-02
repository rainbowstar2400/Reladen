// apps/web/app/api/sync/residents/route.ts
import { NextResponse } from "next/server";

// 必要に応じて本来の処理へ委譲
async function doSyncResidents() {
  // ここに residents 同期ロジック
  return { ok: true };
}

export async function GET() {
  // フロントが GET しているなら GET を許可
  const res = await doSyncResidents();
  return NextResponse.json(res);
}

// 将来 POST 化するならこちらを本流に
export async function POST(req: Request) {
  const res = await doSyncResidents();
  return NextResponse.json(res);
}
