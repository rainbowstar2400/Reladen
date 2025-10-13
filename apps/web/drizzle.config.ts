// apps/web/drizzle.config.ts
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/drizzle/schema.ts',   // ← スキーマファイルの場所（次の手順で作成）
  out: './drizzle',                        // 生成物の出力先
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,        // .env の DATABASE_URL を使う
  },
} satisfies Config;