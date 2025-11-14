// apps/web/lib/drizzle/db.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 【重要】
// このデータベースURLは、RLS（Row Level Security）によって保護されていない、
// サーバーアクションで利用可能なサービスロールキーを含むURLである必要があります。
// Supabaseから提供されるPostgreSQL接続URLを使用してください。
const connectionString = process.env.DATABASE_URL; 

// Drizzle ORMの推奨される方法で、DBクライアントをシングルトンとして初期化
// ※ 本番環境では接続プール（pool: true）の使用を推奨します。
const client = postgres(connectionString!, {
  ssl: 'allow', // SupabaseではSSL接続が必要です
  max: 10,      // 最大接続数
});

// スキーマ定義を渡してDrizzleクライアントを作成
export const db = drizzle(client, { schema });

// Drizzleのマイグレーションツールで使用するためにもエクスポート
export * from 'drizzle-orm';