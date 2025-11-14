// apps/web/scripts/seed.ts

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local ファイルを明示的に読み込む
// __dirname は /apps/web/scripts なので、../ で /apps/web に移動する
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { presets } from '../lib/drizzle/schema'; //
import { DEFAULT_PRESETS } from '../lib/data/presets'; //

const connectionString = process.env.DATABASE_URL; //
if (!connectionString) {
  throw new Error('DATABASE_URL is not set!');
}

// Drizzle のマイグレーション（drizzle-kit）とは別に、
// スクリプトからDBを操作するためにクライアント接続を確立します。
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log('Seeding default presets...');

  // lib/data/presets.ts の DEFAULT_PRESETS 配列 のデータを
  // Supabase DB の presets テーブル に INSERT します。
  await db.insert(presets)
    .values(DEFAULT_PRESETS)
    .onConflictDoNothing(); // 既に同じIDが存在する場合は何もしない（安全対策）

  console.log('Seeding complete.');
  await client.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});