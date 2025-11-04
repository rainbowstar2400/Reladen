// apps/web/lib/db-cloud/supabase.ts
'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  console.warn('Supabase環境変数が設定されていません。Realtime同期は無効化されます。');
}

export const supabaseClient = createClient(url, anon, {
  auth: {
    persistSession: true,
    storageKey: `reladen-auth:${typeof window !== 'undefined' ? location.hostname : 'server'}`,
  },
  // ...realtime等の既存設定があればそのまま
}) as SupabaseClient; // ★ 非nullに固定
