// apps/web/env.ts
import { z } from "zod";

// ▼ 追加：.env/.env.local を自動読込（apps/web とリポジトリ直下の両方を試す）
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import fs from "node:fs";

const candidatePaths = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  // monorepo ルート想定（apps/web から 1 つ上）
  path.resolve(process.cwd(), "../..", ".env.local"),
  path.resolve(process.cwd(), "../..", ".env"),
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    expand(config({ path: p }));
  }
}

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "Missing OPENAI_API_KEY"),
});

export const env = envSchema.parse(process.env);
