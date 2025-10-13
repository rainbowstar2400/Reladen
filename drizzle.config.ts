import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './apps/web/lib/drizzle/schema.ts',
  out: './apps/web/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://user:password@localhost:5432/postgres',
  },
});
