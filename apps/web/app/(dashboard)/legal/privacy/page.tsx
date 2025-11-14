// /apps/web/app/(dashboard)/legal/privacy/page.tsx

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 text-foreground/90">
      <h1 className="text-3xl font-bold text-foreground">プライバシーポリシー</h1>
      <p>
        このプライバシーポリシー（以下「本ポリシー」といいます。）は、
        <strong className="font-semibold">優</strong>
        （以下「当方」といいます。）が提供するアプリケーション「Reladen」（以下「本アプリ」といいます。）における、利用者に関する情報の取り扱いについて定めたものです。
      </p>

      {/* 第1条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第1条（収集する情報と利用目的）</h2>
        <p>当方は、本アプリの提供にあたり、以下の情報を収集・利用することがあります。</p>
        <ol className="list-decimal list-inside space-y-3 pl-4">
          <li>
            <strong>認証情報（Googleアカウント連携）</strong>
            <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
              <li>利用目的：本アプリへのログイン、アカウントの識別、およびデータ同期機能の提供のため。</li>
              <li>収集する情報：Googleアカウントのメールアドレス、およびGoogleによって提供されるユーザー識別子。</li>
              <li>参照：本アプリは、認証基盤としてSupabase を利用しており、Supabaseを介してGoogle認証 を行います。</li>
            </ul>
          </li>
          <li>
            <strong>利用者が入力するデータ</strong>
            <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
              <li>利用目的：本アプリのコア機能（住人情報の管理、関係性の記録、会話生成機能など）を提供するため、およびデータ同期機能によって複数端末間でデータを共有するため。</li>
              <li>
                収集する情報：利用者が本アプリ上（ローカルまたはクラウド）で作成・入力する以下の情報。
                <ul className="list-disc list-inside pl-6 mt-1">
                  <li>住人情報：住人の氏名、基本情報（年齢、性別など）、性格情報（口調、MBTIなど）、および住人に関連付けて利用者が入力するその他の属性情報。</li>
                  <li>関係性・印象の情報：住人同士の関係性、および住人に対する印象（好感度など）の記録。</li>
                  <li>各種ログ：住人同士の間で発生した会話の記録、住人からの相談内容、および関連する会話ログ。</li>
                </ul>
              </li>
            </ul>
          </li>
          <li>
            <strong>連絡フォーム（Googleフォーム）を通じて取得する情報</strong>
            <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
              <li>利用目的：利用者からのお問い合わせ、不具合報告、ご意見・ご感想に対応するため。</li>
              <li>収集する情報：連絡種別、お問い合わせ内容、ご利用環境、および任意でご提供いただく連絡先（メールアドレスなど）。</li>
            </ul>
          </li>
        </ol>
      </section>

      {/* 第2条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第2条（情報の保存先）</h2>
        <p>本アプリで取り扱うデータは、利用者の選択（同期設定）に基づき、以下の場所に保存されます。</p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
          <li>
            <strong>ローカルストレージ</strong>
            <p>利用者の端末（ブラウザのIndexedDBなど）にデータが保存されます。同期をオフにした場合、データはこの領域のみに保存されます。</p>
          </li>
          <li>
            <strong>クラウドストレージ（Supabase）</strong>
            <p>
              同期設定 をオンにした場合、
              {/* ★修正反映箇所：第1条第3項 → 第1条第1項および第2項 */}
              <strong className="font-semibold text-primary">第1条第1項および第2項</strong>
              で収集した情報は、Supabase（プライバシーポリシー：
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                https://supabase.com/privacy
              </a>
              ）の提供するデータベースに保存されます。
            </p>
          </li>
        </ol>
      </section>

      {/* 第3条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第3条（第三者への提供）</h2>
        <p>当方は、以下の場合を除き、利用者の情報を第三者に提供することはありません。</p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
          <li>法令に基づく場合。</li>
          <li>
            本アプリの機能を提供するために必要な場合。
            <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
              <li>認証およびデータ保存のために、Supabase社およびGoogle社（Google認証利用のため）に対して、必要な情報（ユーザー識別子や保存データなど）が送信されます。</li>
              <li>
                連絡フォームの利用（Googleフォーム）に伴い、Google社（プライバシーポリシー：
                <a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  https://policies.google.com/privacy?hl=ja
                </a>
                ）に回答データが送信されます。
              </li>
              <li>
                会話生成機能（相談機能など）の提供のために、
                {/* ★修正反映箇所：第1条第3項 → 第1条第2項 */}
                <strong className="font-semibold text-primary">第1条第2項</strong>
                に定める情報（住人情報、関係性、各種ログなど）を、OpenAI, L.L.C.（以下「OpenAI社」）の提供するAPIに送信します。
                OpenAI社は、APIを通じて受信したデータを同社のモデル学習に利用しない方針を定めています。（詳細は同社のエンタープライズプライバシー 
                <a href="https://openai.com/ja-JP/enterprise-privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  https://openai.com/ja-JP/enterprise-privacy
                </a>
                 または 利用ポリシー 
                <a href="https://openai.com/ja-JP/policies/usage-policies" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  https://openai.com/ja-JP/policies/usage-policies
                </a>
                 をご確認ください）
              </li>
            </ul>
          </li>
        </ol>
      </section>

      {/* 第4条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第4条（データへのアクセス・削除）</h2>
        <p>利用者は、本アプリ内の機能（設定画面など）を通じて、自身のアカウント情報や入力したデータを確認、修正することができます。</p>
        <p>
          利用者が本アプリ内のアカウント削除機能（
          <strong className="font-semibold">「設定」ページ内「アカウント削除」</strong>
          ）を実行した場合、クラウド（Supabase）上に保存されたデータも削除されます。
        </p>
        <p>
          万が一、機能が正常に動作しない等でお困りの場合は
          <strong className="font-semibold">「Reladen」連絡フォーム」</strong>
          までご連絡ください。
        </p>
      </section>

      {/* 第5条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第5条（免責事項）</h2>
        <p>当方は、本アプリの利用によって生じたいかなる損害についても、一切の責任を負いません。本アプリは、利用者の自己責任においてご利用ください。</p>
      </section>

      {/* 第6条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第6条（本ポリシーの変更）</h2>
        <p>当方は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは、本アプリ内または当方が別途定める方法で利用者に通知または公表します。</p>
      </section>

      {/* 第7条 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground border-b pb-2">第7条（お問い合わせ）</h2>
        <p>本ポリシーに関するお問い合わせは、本アプリの連絡フォーム（Googleフォーム） よりお願いいたします。</p>
      </section>

      {/* 制定日 */}
      <p className="text-right mt-8">
        制定日：<strong className="font-semibold">2025年11月20日</strong>
      </p>
    </div>
  );
}