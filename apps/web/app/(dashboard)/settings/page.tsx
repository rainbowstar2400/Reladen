'use client'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/lib/use-settings'
import { useAuth } from '@/lib/auth/use-auth';
import { clearLocalAll } from '@/lib/db-local';
import { supabaseClient } from '@/lib/db-cloud/supabase';
import { deleteAccountAction } from '@/app/actions/delete-account';

const ROLLOVERS = ['00:00', '04:00', '05:00', '06:00', '07:00', '08:00'] as const

export default function SettingsPage() {
  const { s, setS } = useSettings()
  const { setTheme } = useTheme()

  const setThemeAll = (v: 'light' | 'dark' | 'system') => {
    setS(prev => ({ ...prev, theme: v }))
    setTheme(v)
  }

  const contactUrl = process.env.NEXT_PUBLIC_CONTACT_URL;

  return (
    <div className="space-y-10">

      {/* データ管理 */}
      <section id="data" className="scroll-mt-24">
        <h2 className="mb-2 text-2xl font-semibold">データ管理</h2>
        <div className="h-px w-full bg-border mb-4" />

        <div className="space-y-4 max-w-3xl">
          {/* アカウント（ログイン/ログアウト） */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">アカウント</div>
              <div className="text-xs text-muted-foreground">
                {supabaseClient ? 'ログインすると複数端末でデータを同期します' : 'Supabase未設定のためローカルのみで動作中'}
              </div>
            </div>

            {/* 状態に応じてボタンを出し分け */}
            <AccountButtons />
          </CardContent></Card>

          {/* 同期設定 */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">同期設定</div>
              <div className="text-xs text-muted-foreground">オンを推奨します</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{s.syncEnabled ? 'オン' : 'オフ'}</span>
              <Switch checked={s.syncEnabled} onCheckedChange={(v) => setS(p => ({ ...p, syncEnabled: v }))} />
            </div>
          </CardContent></Card>

          {/* ★ 変更箇所: 初期化（実装版）をアカウント削除に置き換え */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">アカウント削除</div>
              <div className="text-xs text-muted-foreground">アカウントと関連する全てのデータ（ローカルおよびクラウド）を削除します。</div>
            </div>
            <Button
              variant="destructive"
              // ログイン中でない、またはSupabase未設定の場合はボタンを無効化
              disabled={!supabaseClient || !useAuth().user}
              onClick={async () => {
                // ローカルデータも削除されることを明示
                if (!confirm('【最終確認】アカウントと全てのデータが削除されます。元に戻せません。本当に実行しますか？')) return;

                // 1. サーバーアクションを呼び出し、クラウドデータを削除し、ログアウトさせる
                const result = await deleteAccountAction();

                if (result.success) {
                  // 2. 成功したらローカルデータも削除し、UIを更新
                  await clearLocalAll();
                  alert('アカウントと全てのデータが削除されました。リダイレクトします。');
                } else {
                  alert(`アカウント削除に失敗しました: ${result.message}\n（失敗した場合、ローカルデータは残っています）`);
                }
              }}
            >
              アカウントを削除する
            </Button>
          </CardContent></Card>

        </div>
      </section>

      {/* アクセシビリティ */}
      <section id="a11y" className="scroll-mt-24">
        <h2 className="mb-2 text-2xl font-semibold">アクセシビリティ</h2>
        <div className="h-px w-full bg-border mb-4" />

        <div className="space-y-4 max-w-3xl">
          {/* カラーテーマ */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">カラーテーマ</div>
              <div className="text-xs text-muted-foreground">デフォルトテーマを選択</div>
            </div>
            <div className="flex gap-2">
              <Button variant={s.theme === 'light' ? 'secondary' : 'outline'} onClick={() => setThemeAll('light')}>ライト</Button>
              <Button variant={s.theme === 'dark' ? 'secondary' : 'outline'} onClick={() => setThemeAll('dark')}>ダーク</Button>
              <Button variant={s.theme === 'system' ? 'secondary' : 'outline'} onClick={() => setThemeAll('system')}>システム</Button>
            </div>
          </CardContent></Card>

          {/* フォントサイズ */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div className="font-medium">フォントサイズ</div>
            <div className="flex gap-2">
              <Button variant={s.fontSize === 'small' ? 'secondary' : 'outline'} onClick={() => setS(p => ({ ...p, fontSize: 'small' }))}>小</Button>
              <Button variant={s.fontSize === 'medium' ? 'secondary' : 'outline'} onClick={() => setS(p => ({ ...p, fontSize: 'medium' }))}>中</Button>
              <Button variant={s.fontSize === 'large' ? 'secondary' : 'outline'} onClick={() => setS(p => ({ ...p, fontSize: 'large' }))}>大</Button>
            </div>
          </CardContent></Card>

          {/* 軽量設定 */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">軽量設定</div>
              <div className="text-xs text-muted-foreground">アニメーションを減らして動作を軽量化</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{s.reduceMotion ? 'オン' : 'オフ'}</span>
              <Switch checked={s.reduceMotion} onCheckedChange={(v) => setS(p => ({ ...p, reduceMotion: v }))} />
            </div>
          </CardContent></Card>

          {/* 日付更新 */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">日付更新</div>
              <div className="text-xs text-muted-foreground">1日の区切りの時刻を設定</div>
            </div>
            <select value={s.dayRollover} onChange={e => setS(p => ({ ...p, dayRollover: e.target.value as any }))} className="rounded-md border px-2 py-1 text-sm bg-background">
              {ROLLOVERS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </CardContent></Card>
        </div>
      </section>

      {/* ゲームについて */}
      <section id="about" className="scroll-mt-24">
        <h2 className="mb-2 text-2xl font-semibold">ゲームについて</h2>
        <div className="h-px w-full bg-border mb-4" />

        <div className="space-y-4 max-w-3xl">
          {/* アプリ情報 */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div className="font-medium">アプリ情報</div>
            <div className="text-sm text-muted-foreground">Reladen　ver.0.10　制作：優</div>
          </CardContent></Card>

          {/* プライバシーポリシー（内部遷移） */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div className="font-medium">プライバシーポリシー</div>
            <Button variant="outline" asChild><Link href="/legal/privacy">開く</Link></Button>
          </CardContent></Card>

          {/* 連絡フォーム（外部リンク可） */}
          <Card><CardContent className="flex items-center justify-between py-3">
            <div className="font-medium">連絡フォーム</div>
            {/* 外部リンクが設定されている場合のみボタンを有効化 */}
            <Button
              variant="outline"
              asChild
              disabled={!contactUrl}
              title={!contactUrl ? '環境変数 NEXT_PUBLIC_CONTACT_URL を設定してください' : undefined}
            >
              {/* 変更箇所3: hrefをcontactUrlに固定し、外部リンクのためtarget="_blank"に固定 */}
              <a
                href={contactUrl ?? '#'} // リンクがない場合は # にフォールバック (disabledなので押せないが安全のため)
                target="_blank"
                rel="noopener noreferrer"
              >
                開く
              </a>
            </Button>
          </CardContent></Card>
        </div>
      </section>
    </div>
  )
}

function AccountButtons(): JSX.Element {
  const { ready, user, signInWithGoogle, signOut, hasSupabase, linkWithGoogle } = useAuth();

  if (!hasSupabase) return <Button variant="outline" disabled>ローカル動作中</Button>;
  if (!ready) return <Button variant="outline" disabled>状態確認中…</Button>;
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={signInWithGoogle}>Googleでログイン</Button>
      </div>
    );
  }

  const linked = new Set(user.providers ?? (user.provider ? [user.provider] : []));
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {user.email ?? 'ログイン中'}
        {linked.size > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="text-xs">連携済み：</span>
            <span className="text-xs">{Array.from(linked).join(', ')}</span>
          </span>
        )}
      </span>
      {!linked.has('google') && (
        <Button variant="outline" onClick={linkWithGoogle}>Google を紐づけ</Button>
      )}
      <Button variant="outline" onClick={signOut}>ログアウト</Button>
    </div>
  );
}
