// apps/web/app/actions/delete-account.ts

'use server'

import { revalidatePath } from 'next/cache';

// ★ 修正点1: createServerClient ではなく、実際にエクスポートされている sbServer をインポート
import { sbServer } from '@/lib/supabase/server'; 
import { eq } from 'drizzle-orm'; 

// Drizzle ORM関連のインポート (db.tsが正しく作成されている前提)
import { db } from '@/lib/drizzle/db'; 
import * as schema from '@/lib/drizzle/schema'; 

/**
 * アカウントとクラウド上の関連データを削除するサーバーアクション。
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteAccountAction() {
  // ★ 修正点1: sbServer() を使用
  const supabase = sbServer(); 
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, message: 'ユーザーの認証情報が見つかりません。ログイン状態を確認してください。' };
  }

  const userId = userData.user.id;
  
  try {
    // 1. 関連データの削除をトランザクション内で行う
    await db.transaction(async (tx) => {
        // 【データ整合性のためのDELETE処理】
        // ownerIdを持つ全てのテーブルのレコードを削除します。
        
        // ★ 修正点2 & 3: conversations/consults を削除し、user_id → ownerId に変更

        await tx.delete(schema.presets).where(eq(schema.presets.ownerId, userId));
        await tx.delete(schema.relations).where(eq(schema.relations.ownerId, userId));
        await tx.delete(schema.feelings).where(eq(schema.feelings.ownerId, userId));
        await tx.delete(schema.nicknames).where(eq(schema.nicknames.ownerId, userId));
        await tx.delete(schema.events).where(eq(schema.events.ownerId, userId));
        
        // 最後に住人情報 (Residents) の削除
        await tx.delete(schema.residents).where(eq(schema.residents.ownerId, userId));
    });

    // 2. ユーザー認証の削除 (Supabase Authからユーザーを削除)
    // ※ @/lib/supabase/server がサービスロールキーで初期化されている必要があります。
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Supabase Authユーザー削除に失敗:', deleteError);
      return { success: false, message: `アカウント削除に失敗しました。管理者にお問い合わせください。 (${deleteError.message})` };
    }

    // 3. ログアウト
    await supabase.auth.signOut();

    // 4. キャッシュの再検証
    revalidatePath('/home'); 
    return { success: true, message: 'アカウントと関連するクラウドデータが削除されました。' };

  } catch (e) {
    console.error('データベース処理中に予期せぬエラーが発生しました:', e);
    return { success: false, message: `データベース処理中に予期せぬエラーが発生しました。` };
  }
}