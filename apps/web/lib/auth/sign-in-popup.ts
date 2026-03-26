import { supabaseClient } from '@/lib/db-cloud/supabase';

/**
 * Google OAuth をポップアップウィンドウで開始し、ログイン完了まで待つ。
 * ログイン検知後にポップアップを自動クローズする。
 * ポップアップが手動で閉じられた場合も resolve する（UIが状態を再判定する）。
 */
export function signInWithGooglePopup(): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    if (!supabaseClient) {
      reject(new Error('Supabase client not available'));
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: window.location.origin,
        },
      });

      if (error || !data.url) {
        reject(error ?? new Error('No OAuth URL returned'));
        return;
      }

      const popup = window.open(
        data.url,
        'reladen-auth',
        'width=500,height=600,left=200,top=100',
      );

      const { data: sub } = supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          cleanup();
          resolve();
        }
      });

      // ポップアップが手動で閉じられた場合のフォールバック
      // 別オリジン（Google）に遷移すると COOP により popup.closed にアクセスできなくなるため、
      // その場合はポーリングを停止し onAuthStateChange のみに頼る。
      const timer = setInterval(() => {
        try {
          if (popup?.closed) {
            cleanup();
            resolve();
          }
        } catch {
          // Cross-Origin-Opener-Policy によりアクセス不可 → ポーリング停止
          clearInterval(timer);
        }
      }, 500);

      function cleanup() {
        clearInterval(timer);
        sub.subscription.unsubscribe();
        try { popup?.close(); } catch { /* ignore */ }
      }
    } catch (err) {
      reject(err);
    }
  });
}
