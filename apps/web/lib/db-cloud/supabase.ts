// apps/web/lib/db-cloud/supabase.ts
'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  console.warn('Supabase 環境変数が設定されていません。Realtime 同期は無効化されます。');
}

/**
 * Supabase クライアント。
 * 環境変数が揃っていない場合は null を返し、アプリをローカルモードで動作させます。
 */
export const supabaseClient = (url && anon)
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        storageKey: `reladen-auth:${typeof window !== 'undefined' ? location.hostname : 'server'}`,
      },
    }) as SupabaseClient
  : null;
