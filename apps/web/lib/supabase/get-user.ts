// apps/web/lib/supabase/get-user.ts
'use server';

import 'server-only';
import { sbServer } from './server';

/**
 * サーバ側で現在ログインしているユーザーを取得。
 * - 認証されていなければエラーを投げる。
 * - Supabaseの auth.getUser() を利用。
 */
export async function getUserOrThrow() {
  const sb = sbServer();
  const { data, error } = await sb.auth.getUser();

  if (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
  if (!data?.user) {
    throw new Error('No authenticated user found');
  }

  return data.user;
}
