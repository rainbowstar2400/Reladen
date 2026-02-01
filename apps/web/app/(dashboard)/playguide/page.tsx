import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';

export default function PlayguidePage() {
    return (
        <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
            <OfficePanelShell showTitle={false}>
                <div className="space-y-10 pb-20">
                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight">遊び方</h1>
                    <p className="text-muted-foreground">このページでは、ゲームの基本的なプレイガイドを説明します。</p>
                </div>

                {/* 1. Reladenとは？ */}
                <section id="1" className="space-y-4">
                    <h2 className="text-2xl font-bold border-b pb-2">1. Reladenとは？</h2>
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>
                            ここは、住人たちが暮らす小さな箱庭。<br />
                            彼らは日々の中で、少しずつ関係を築いていきます。
                        </p>
                        <p>
                            どんなつながりが生まれていくのか、それはまだ、誰にもわかりません。
                        </p>
                        <p>
                            あなたは「管理人」として、<br />
                            住人たちの毎日を見守り、ときどき相談に乗りながら、彼らの暮らしを支えていきます。
                        </p>
                        <p>
                            難しい操作は必要なく、住人たちの自然なやり取りを眺めるだけでも楽しめます。
                        </p>
                    </div>
                </section>

                {/* 2. 画面構成 */}
                <section id="2" className="space-y-8">
                    <h2 className="text-2xl font-bold border-b pb-2">2. 画面構成</h2>

                    {/* 2-1. ホーム */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">2-1. ホーム</h3>
                        <p className="text-muted-foreground">
                            ホームは、ゲームを開いたときに最初に表示される画面です。<br />
                            ここでは、住人たちの様子や起こったことなどを把握することができます。
                        </p>
                        <p className="text-muted-foreground">ホームには、次の3つのエリアがあります。</p>

                        <ul className="grid gap-4 pt-2">
                            <li className="bg-card p-4 rounded-lg border shadow-sm">
                                <span className="font-bold block mb-1 text-primary">● お知らせ</span>
                                <span className="text-muted-foreground text-sm">
                                    会話や相談、新聞の更新など、発生した出来事の通知が並ぶエリアです。
                                </span>
                            </li>
                            <li className="bg-card p-4 rounded-lg border shadow-sm">
                                <span className="font-bold block mb-1 text-primary">● みんなの様子</span>
                                <span className="text-muted-foreground text-sm">
                                    登録されている住人と、その「現在の状態」を一覧で表示します。<br />
                                    「話す」から、住人の話を軽く聞くこともできます。
                                </span>
                            </li>
                            <li className="bg-card p-4 rounded-lg border shadow-sm">
                                <span className="font-bold block mb-1 text-primary">● 新聞</span>
                                <span className="text-muted-foreground text-sm">
                                    読み物として、日替わりのダイジェストが表示されるエリアです。<br />
                                    天気や前日の関係の変化、住人のひとことなどがまとめられています。
                                </span>
                            </li>
                        </ul>
                    </div>

                    <hr className="border-dashed" />

                    {/* 2-2. 管理室 */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">2-2. 管理室</h3>
                        <p className="text-muted-foreground">
                            管理室は、住人やプリセットなどをまとめて管理するための場所です。<br />
                            ここから、住人一覧や新規登録、プリセット管理へ移動できます。
                        </p>
                        <p className="text-muted-foreground">
                            「住人を確認したい」「新しく追加したい」「口調や職業のプリセットを編集したい」といったときは、
                            まず管理室を開き、そこから目的のページに進みます。
                        </p>

                        <div className="space-y-6 pt-2 pl-4 border-l-2">
                            <div>
                                <h4 className="font-bold text-lg">住人一覧</h4>
                                <p className="text-muted-foreground mt-1 mb-2">
                                    住人一覧では、登録済みの住人が一覧で表示され、それぞれの基本情報を確認できます。
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-sm">
                                    <li>名前や年齢、職業などの概要を一覧で確認できます。</li>
                                    <li>気になる住人を選ぶと、その人の詳細画面へ移動します。</li>
                                    <li>詳細画面から、情報の編集や削除の操作が行えます。<br />
                                        詳細画面では、その住人が他の住人とどのような関係を持っているかも確認できます。</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold text-lg">新規住人登録</h4>
                                <p className="text-muted-foreground mt-1 mb-2">
                                    新規住人登録では、<span className="font-bold text-foreground">新しく住人を追加</span>できます。
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-sm">
                                    <li>名前や性別、年齢などの基本情報</li>
                                    <li>性格やMBTI、趣味・興味</li>
                                    <li>睡眠スケジュール（生活リズム） など</li>
                                </ul>
                                <p className="text-muted-foreground mt-2 text-sm">住人のプロフィールをここで入力して登録します。</p>
                            </div>

                            <div>
                                <h4 className="font-bold text-lg">プリセット管理</h4>
                                <p className="text-muted-foreground mt-1 mb-2">
                                    プリセット管理では、住人登録で使うためのプリセット、つまり雛形を編集できます。
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-sm">
                                    <li>職業のプリセット</li>
                                    <li>一人称や呼び方のプリセット</li>
                                    <li>口調・話し方のプリセット</li>
                                </ul>
                                <p className="text-muted-foreground mt-2 text-sm">よく使う設定をあらかじめ用意しておくことで、住人を追加するときの入力を少し楽にできます。</p>
                            </div>
                        </div>
                    </div>

                    <hr className="border-dashed" />

                    {/* 2-3. 日報 */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">2-3. 日報</h3>
                        <p className="text-muted-foreground">
                            日報では、これまでに起こった出来事をあとから見返すことができます。<br />
                            住人どうしの会話や、受けた相談の記録がまとめて保存されています。
                        </p>
                        <ul className="space-y-3 pt-2">
                            <li className="flex flex-col gap-1">
                                <span className="font-bold">会話の記録を見る</span>
                                <span className="text-muted-foreground text-sm pl-4 border-l-2">住人どうしが交わした会話の履歴が一覧で表示されます。</span>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-bold">相談の記録を見る</span>
                                <span className="text-muted-foreground text-sm pl-4 border-l-2">住人から受けた相談について、相談の内容と選んだ選択肢が記録されています。</span>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-bold">絞り込み</span>
                                <span className="text-muted-foreground text-sm pl-4 border-l-2">住人名や種類（会話／相談）、そこで起こった住人の変化の種類でフィルタできます。</span>
                            </li>
                        </ul>
                    </div>

                    <hr className="border-dashed" />

                    {/* 2-4. 設定 */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">2-4. 設定</h3>
                        <p className="text-muted-foreground">
                            設定では、ゲーム全体の表示やデータ管理にかかわる項目を変更できます。
                        </p>
                        <dl className="grid gap-4 sm:grid-cols-2 pt-2">
                            <div className="bg-muted/50 p-3 rounded border">
                                <dt className="font-bold">テーマ（ライト／ダーク）</dt>
                                <dd className="text-sm text-muted-foreground mt-1">好みに合わせて画面の明るさを選べます。</dd>
                            </div>
                            <div className="bg-muted/50 p-3 rounded border">
                                <dt className="font-bold">フォントサイズ</dt>
                                <dd className="text-sm text-muted-foreground mt-1">小・中・大から、読みやすい文字サイズに調整できます。</dd>
                            </div>
                            <div className="bg-muted/50 p-3 rounded border">
                                <dt className="font-bold">日付区切り時刻</dt>
                                <dd className="text-sm text-muted-foreground mt-1">日報に表示される日付などについて、「1日」が切り替わる時刻を選べます。</dd>
                            </div>
                            <div className="bg-muted/50 p-3 rounded border">
                                <dt className="font-bold">同期設定・アカウント</dt>
                                <dd className="text-sm text-muted-foreground mt-1">データの同期ON/OFFの切り替えや、アカウントの管理を行うことができます。<br />
                                    ログアウトやアカウントの削除もここから行います。</dd>
                            </div>
                        </dl>
                    </div>
                </section>

                {/* 3. 住人について */}
                <section id="3" className="space-y-8">
                    <h2 className="text-2xl font-bold border-b pb-2">3. 住人について</h2>

                    {/* 3-1. 住人の追加／編集／削除 */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold">3-1. 住人の追加／編集／削除</h3>

                        <div className="grid gap-6 md:grid-cols-3">
                            {/* 追加 */}
                            <div className="space-y-3 p-5 border rounded-lg bg-card shadow-sm">
                                <h4 className="font-bold text-lg flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                    住人を追加する
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    新しい住人を登録するときは、管理室トップから<span className="font-bold text-foreground">「新規住人登録」</span>を開きます。<br />
                                    名前や性別、性格などを入力し、「保存」ボタンを押すと完了です。
                                </p>
                                <div className="text-xs text-muted-foreground bg-muted p-3 rounded mt-2">
                                    <p>入力項目はあとで自由に編集できるので、最初は大まかな設定でも問題ありません。</p>
                                    <p className="mt-1">必須項目以外は登録しなくても保存できます。</p>
                                </div>
                            </div>

                            {/* 編集 */}
                            <div className="space-y-3 p-5 border rounded-lg bg-card shadow-sm">
                                <h4 className="font-bold text-lg flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary/60" />
                                    登録内容を編集する
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    登録済みの住人の情報を変更したいときは、住人一覧の右端、
                                    もしくは詳細画面にある <span className="font-bold text-foreground">「編集」ボタン</span> を押します。
                                </p>
                                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1 bg-muted/30 p-2 rounded">
                                    <li>誕生日を直したい</li>
                                    <li>職業や話し方を変えたい</li>
                                    <li>睡眠時間を調整したい</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    など、気になった部分はいつでも修正できます。
                                </p>
                            </div>

                            {/* 削除 */}
                            <div className="space-y-3 p-5 border rounded-lg bg-card border-destructive/20 shadow-sm">
                                <h4 className="font-bold text-lg flex items-center gap-2 text-destructive">
                                    <span className="w-2 h-2 rounded-full bg-destructive" />
                                    住人を削除する
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    住人を削除したい場合は、詳細画面の下部にある <span className="font-bold text-destructive">「削除」ボタン</span> を使います。
                                </p>
                                <div className="text-xs bg-destructive/10 text-destructive p-3 rounded space-y-2 mt-2">
                                    <p className="font-bold flex items-center gap-1">
                                        ⚠️ 注意
                                    </p>
                                    <p>削除すると、その住人に関する会話や相談の記録もすべて消えてしまうため、慎重に操作してください。</p>
                                    <p>その住人と関係を持っていた他の住人からも、その住人との関係についてのデータが削除されます。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr className="border-dashed" />

                    {/* 3-2. 登録できる情報 */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-xl font-semibold">3-2. 登録できる情報</h3>
                            <p className="text-muted-foreground">
                                住人を登録するときには、次のような情報を設定できます。<br />
                                すべての項目はあとから編集可能です。
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* 基本情報 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg border-b pb-2">● 基本情報</h4>
                                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                                    <li><span className="font-medium text-foreground">名前・性別・年齢</span></li>
                                    <li>
                                        <span className="font-medium text-foreground">誕生日</span>
                                        <p className="text-xs mt-0.5 opacity-80">誕生日を登録しておくと、その日に他の住人が祝ってくれます。</p>
                                    </li>
                                    <li>
                                        <span className="font-medium text-foreground">職業</span>
                                        <p className="text-xs mt-0.5 opacity-80">会話や相談の中で、住人がその職業に関連した話をすることがあります。</p>
                                    </li>
                                </ul>
                            </div>

                            {/* 興味・好きなもの */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg border-b pb-2">● 興味・好きなもの</h4>
                                <div className="flex gap-2 flex-wrap">
                                    <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">読書</span>
                                    <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">音楽</span>
                                    <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">海</span>
                                    <span className="text-xs text-muted-foreground self-center">...など</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    自由なタグで登録できます。数に制限はありません。<br />
                                    関連したものに会話の中で触れることが多くなります。
                                </p>
                            </div>

                            {/* 睡眠時間 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg border-b pb-2">● 睡眠時間</h4>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="bg-muted px-3 py-1 rounded">就寝時刻</div>
                                    <span className="text-muted-foreground">／</span>
                                    <div className="bg-muted px-3 py-1 rounded">起床時刻</div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    この時間帯によって、「活動中」「就寝準備中」「就寝中」の状態が自動的に切り替わります。<br />
                                    就寝中は会話が起こりません。
                                    <span className="block mt-1 text-xs opacity-80">
                                        ※就寝準備中では会話が起こります
                                    </span>
                                </p>
                                <div className="bg-muted/30 p-2 rounded text-xs text-muted-foreground">
                                    実際の就寝／起床時刻は、毎日少しずつ異なります。あくまで基準として登録します。
                                </div>
                            </div>

                            {/* パーソナリティ */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                                <h4 className="font-bold text-lg border-b pb-2">● パーソナリティ</h4>

                                <div className="space-y-2">
                                    <h5 className="font-bold text-base">MBTIタイプ</h5>
                                    <p className="text-sm text-muted-foreground">
                                        「診断」を押すと、簡易的な質問による大まかな診断を行えます。手動選択も可能です。
                                    </p>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <h5 className="font-bold text-base">5つの性格パラメータ</h5>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="bg-muted/40 p-3 rounded border">
                                            <span className="font-bold block text-sm mb-1">社交性</span>
                                            <span className="text-xs text-muted-foreground">周りの人に対して、自分からより積極的に関わりに行くことを示します。</span>
                                        </div>
                                        <div className="bg-muted/40 p-3 rounded border">
                                            <span className="font-bold block text-sm mb-1">共感力</span>
                                            <span className="text-xs text-muted-foreground">周りの人に対して、より寄り添った言葉をかけることを示します。</span>
                                        </div>
                                        <div className="bg-muted/40 p-3 rounded border">
                                            <span className="font-bold block text-sm mb-1">頑固さ</span>
                                            <span className="text-xs text-muted-foreground">自分の考えや行動を、より曲げずに持ち続ける／行うことを示します。</span>
                                        </div>
                                        <div className="bg-muted/40 p-3 rounded border">
                                            <span className="font-bold block text-sm mb-1">行動力</span>
                                            <span className="text-xs text-muted-foreground">自分で考えたことを、よりすぐに、確実に行動に移すことを示します。</span>
                                        </div>
                                        <div className="bg-muted/40 p-3 rounded border">
                                            <span className="font-bold block text-sm mb-1">表現力</span>
                                            <span className="text-xs text-muted-foreground">自分で考えたことや感じたことを、より豊かな言葉で表すことを示します。</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground text-right">
                                        それぞれ1～5の数値で設定します。<br />
                                        数値が高いほど、そのパラメータが性格として顕著に表れていることを示します。
                                    </p>
                                </div>
                            </div>

                            {/* 元々の関係 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg border-b pb-2">● 元々の関係</h4>
                                <p className="text-sm text-muted-foreground">
                                    その住人が、既に登録済みの住人との間に関係を持っている場合、その関係を登録できます。
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                    <li>住人同士の関係</li>
                                    <li>お互いの好感度</li>
                                    <li>お互いの呼び方</li>
                                </ul>
                                <div className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-3 rounded text-xs space-y-1">
                                    <p className="font-bold">💡 好感度設定のヒント</p>
                                    <p>はじめから100にすることはおすすめしません。</p>
                                    <p>高くても60程度に留めておくことをおすすめします。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr className="border-dashed" />

                    {/* 3-3. 住人同士の関係性 */}
                    <div className="space-y-6">
                        <div className="space-y-4 text-muted-foreground leading-relaxed">
                            <h3 className="text-xl font-semibold text-foreground">3-3. 住人同士の関係性</h3>
                            <p>
                                住人どうしの繋がりや、その住人が他の住人に感じていることなどを、<br />
                                住人の詳細画面から確認できます。
                            </p>
                            <p>
                                これらは会話を通して、少しずつ変化していきます。<br />
                                住人たちの日常を知る手がかりとして、ぜひ確認してみてください。
                            </p>
                            <p>
                                この関係は、住人たちが会話を重ねていく中で自然に変化します。<br />
                                仲良くなったり、離れたり、会話の内容によって、変化の方向は異なります。
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* 関係の種類 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                                <h4 className="font-bold text-lg border-b pb-2">● 関係の種類</h4>
                                <p className="text-sm text-muted-foreground">
                                    住人どうしの「今の関係」に関する項目です。
                                </p>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                    <li>知り合い</li>
                                    <li>友達</li>
                                    <li>親友</li>
                                    <li>恋人</li>
                                    <li>家族</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    などがあります。
                                </p>
                                <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                    この関係が親密になるほど、より深い話をするようになります。
                                </p>
                            </div>

                            {/* 印象 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                                <h4 className="font-bold text-lg border-b pb-2">● 印象</h4>
                                <p className="text-sm text-muted-foreground">
                                    「印象」は、相手をどう思っているかを示す、一方向の感情です。
                                </p>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                    <li>気になる</li>
                                    <li>好きかも</li>
                                    <li>嫌いかも</li>
                                    <li>気まずい</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    などがあります。
                                </p>
                                <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                    印象は片方向のものなので、<br />
                                    例えば A は B を「気になる」と思っていても、B は A を「気まずい」と思っている──<br />
                                    ということも起こります。
                                </p>
                            </div>

                            {/* 好感度の表示 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                                <h4 className="font-bold text-lg border-b pb-2">● 好感度の表示</h4>
                                <p className="text-sm text-muted-foreground">
                                    好感度は、相手のことをどの程度よく思っているかを大まかに表したものです。
                                </p>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                    <li>高いほど親しい</li>
                                    <li>低いと距離がある</li>
                                    <li>ゆるやかに増減する</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    といった、ざっくりとしたイメージでとらえるとわかりやすいです。
                                </p>
                                <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                    会話による変化としても実際の細かい数値は表示されず、上昇／下降のみが示されます。
                                </p>
                            </div>

                            {/* 呼び方 */}
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                                <h4 className="font-bold text-lg border-b pb-2">● 呼び方</h4>
                                <p className="text-sm text-muted-foreground">
                                    住人がその相手をどう呼ぶかも、詳細画面で確認できます。
                                </p>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                    <li>「さん」付け</li>
                                    <li>呼び捨て</li>
                                    <li>あだ名</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    など、住人によって様々な呼び方をします。
                                </p>
                                <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                    呼び方は、「元々の関係」で登録しない限り、<br />
                                    その相手と関係を持ったタイミングで、住人に応じて自動で設定されます。
                                </p>
                            </div>
                        </div>
                    </div>

                    <hr className="border-dashed" />

                    {/* 3-4. あなたとの関わり方 */}
                    <div className="space-y-6">
                        <div className="space-y-4 text-muted-foreground leading-relaxed">
                            <h3 className="text-xl font-semibold text-foreground">3-4. あなたとの関わり方</h3>
                            <p>
                                あなたは「管理人」として、<br />
                                相談を受けたり、話を聞いたりして、住人と関わることができます。
                            </p>
                        </div>

                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                            <h4 className="font-bold text-lg border-b pb-2">● 信頼度</h4>
                            <p className="text-sm text-muted-foreground">
                                住人によって、あなたのことをどう思っているかが異なります。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                信頼度は、その住人があなたをどの程度よく思っているのかを表したものです。<br />
                                主に相談を受ける中で、選んだ選択肢によって増減します。<br />
                                性格によって、上がりやすい、または下がりやすいなどの傾向があります。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                信頼度が高いほど、<br />
                                より相談をする頻度が高くなったり、<br />
                                内容が深くなったりしていきます。
                            </p>
                            <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                あなたへの話し方・接し方に大きく影響します。
                            </p>
                        </div>
                    </div>

                </section>

                {/* 4. ゲームの進み方 */}
                <section id="4" className="space-y-8">
                    <h2 className="text-2xl font-bold border-b pb-2">4. ゲームの進み方</h2>

                    {/* 4-1. ゲーム内で起こる出来事 */}
                    <div className="space-y-6">
                        <div className="space-y-4 text-muted-foreground leading-relaxed">
                            <h3 className="text-xl font-semibold text-foreground">4-1. ゲーム内で起こる出来事</h3>
                            <p>
                                このゲームでは、住人たちがそれぞれの生活を送りながら、<br />
                                <span className="font-bold text-foreground">自動的にさまざまな出来事が発生</span>します。
                            </p>
                            <p>
                                主に次のようなものがあります。
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg">● 住人どうしの会話</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    起きている住人の間で、自然に会話が起こります。<br />
                                    誰と誰が話すのか、どんな雰囲気になるのかは毎回異なります。
                                </p>
                            </div>

                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg">● 印象や好感度の変化</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    会話や出来事をきっかけに、相手への印象が変わったり、距離が縮まったりします。
                                </p>
                            </div>

                            <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                                <h4 className="font-bold text-lg">● 新聞の更新</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    その日1日の会話や出来事を、読み物のようにまとめた「新聞」が掲載されます。<br />
                                    1日の終わりに、今日の出来事を振り返ることができます。<br />
                                    ちょっとしたおまけコンテンツなども楽しむことができます。
                                </p>
                            </div>
                        </div>

                        <p className="text-muted-foreground leading-relaxed">
                            これらの出来事はすべて自動で進み、<br />
                            あなたが操作しなくても、住人たちの毎日はゆっくり動いていきます。
                        </p>
                    </div>

                    <hr className="border-dashed" />

                    {/* 4-2. 確認の仕方 */}
                    <div className="space-y-6">
                        <div className="space-y-4 text-muted-foreground leading-relaxed">
                            <h3 className="text-xl font-semibold text-foreground">4-2. 確認の仕方</h3>
                            <p>
                                起こった出来事は、まず<span className="font-bold text-foreground">ホームのお知らせ</span>に、通知として届きます。
                            </p>

                            <div className="bg-muted/30 p-4 rounded-lg border">
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>会話が発生した</li>
                                    <li>新聞が更新された</li>
                                    <li>相談が届いた（相談の詳細は5章で説明）</li>
                                </ul>
                            </div>

                            <p>
                                など、その時点で起こったことが、このお知らせに順に並んでいきます。
                            </p>
                            <p>
                                それぞれの通知をクリックすると、その詳細が確認できます。
                            </p>
                        </div>
                    </div>
                </section>

                {/* 5. あなたができること */}
                <section id="5" className="space-y-8">
                    <h2 className="text-2xl font-bold border-b pb-2">5. あなたができること</h2>
                    <p className="text-muted-foreground">
                        ここでは、あなたが実際に操作できることを紹介します。
                    </p>

                    <div className="grid gap-6 md:grid-cols-3">
                        {/* 5-1. 住人を登録・編集する */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                            <h3 className="font-bold text-lg border-b pb-2">5-1. 住人を登録・編集する</h3>
                            <p className="text-sm text-muted-foreground">
                                管理室では、新しく住人を登録したり、<br />
                                登録した情報を変更したりすることができます。
                            </p>
                            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                                <p>
                                    削除することも可能ですが、<br />
                                    取り返しがつかないため、操作は慎重に行ってください。
                                </p>
                            </div>
                        </div>

                        {/* 5-2. 相談に答える */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                            <h3 className="font-bold text-lg border-b pb-2">5-2. 相談に答える</h3>
                            <p className="text-sm text-muted-foreground">
                                住人から悩みごとが届くことがあります。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                お知らせの通知を開くと、住人からの相談が表示されます。<br />
                                ここでは、いくつかの選択肢から<br />
                                あなたが思うことに近いものを選んでください。
                            </p>
                            <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                <p>
                                    回答は一度きりで、やり直しはできません。<br />
                                    選んだ選択肢によって、その住人からの信頼度が変わることがあります。
                                </p>
                            </div>
                        </div>

                        {/* 5-3. 設定を変更する */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                            <h3 className="font-bold text-lg border-b pb-2">5-3. 設定を変更する</h3>
                            <p className="text-sm text-muted-foreground">
                                「設定」では、ゲームの表示やデータの管理に関する項目を変更できます。<br />
                                お好みに合わせて、遊びやすいように調整してください。
                            </p>
                        </div>
                    </div>
                </section>

                {/* 6. データの保存と同期 */}
                <section id="6" className="space-y-8">
                    <h2 className="text-2xl font-bold border-b pb-2">6. データの保存と同期</h2>
                    <p className="text-muted-foreground">
                        ここでは、Reladenのデータがどのように保存されるかを説明します。
                    </p>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* 6-1. ログインについて */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                            <h3 className="font-bold text-lg border-b pb-2">6-1. ログインについて（必須）</h3>
                            <p className="text-sm text-muted-foreground">
                                Reladenを利用するには、はじめにアカウントでログインする必要があります。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                ログインすることで、あなたの住人や関係の情報が<br />
                                オンライン上のデータベースに保存されます。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                ログインしておくことで、
                            </p>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                <li>別の端末から同じデータを開ける</li>
                                <li>ブラウザを閉じたり、PCを再起動しても続きから遊べる</li>
                            </ul>
                            <p className="text-sm text-muted-foreground">
                                といったメリットがあります。
                            </p>
                        </div>

                        {/* 6-2. 基本はオンラインで自動セーブ */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                            <h3 className="font-bold text-lg border-b pb-2">6-2. 基本はオンラインで自動セーブ</h3>
                            <p className="text-sm text-muted-foreground">
                                Reladenでは、<span className="font-bold text-foreground">手動でセーブする必要はありません。</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                                住人を登録・編集したり、相談に答えたりすると、<br />
                                その内容は自動的にオンラインのデータベースへ保存されます。
                            </p>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                <li>特別な操作をしなくても、普段の操作の中で保存されます</li>
                                <li>「同期」ボタンで、手動で保存を行うことは可能です</li>
                            </ul>
                            <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                                ゲームを閉じても、次に開いたときには<br />
                                最後に操作した状態から再開できます。
                            </p>
                        </div>
                    </div>

                    {/* 6-3. オフラインでも遊べる場合 */}
                    <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                        <h3 className="font-bold text-lg border-b pb-2">6-3. オフラインでも遊べる場合</h3>
                        <p className="text-sm text-muted-foreground">
                            インターネットに一時的につながらなくなっても、<br />
                            しばらくの間はそのまま遊ぶことができます。
                        </p>
                        <p className="text-sm text-muted-foreground">
                            このときの変更内容は、一度あなたの端末の中に保存され、<br />
                            あとからネットに再びつながったときに、オンラインのデータと同期されます。
                        </p>
                        <p className="text-sm text-muted-foreground">
                            ただし、
                        </p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li>長時間オフラインが続く場合</li>
                            <li>別の端末と行き来しながら使う場合</li>
                        </ul>
                        <p className="text-sm text-muted-foreground">
                            などは、なるべくインターネットにつながる環境での利用をおすすめします。
                        </p>
                    </div>

                    {/* 6-4. 同期設定とアカウント管理 */}
                    <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                        <h3 className="font-bold text-lg border-b pb-2">6-4. 同期設定とアカウント管理</h3>
                        <p className="text-sm text-muted-foreground">
                            「設定」では、データの同期やアカウントに関する操作ができます。
                        </p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li>自動同期のオン／オフを切り替える</li>
                            <li>ログアウトする</li>
                            <li>アカウントを削除する</li>
                        </ul>
                        <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                            <p>
                                アカウントを削除すると、オンライン上のデータも消えてしまいます。<br />
                                やり直せない操作のため、よく確認してから行ってください。
                            </p>
                        </div>
                    </div>

                </section>

                {/* 7. よくある質問 */}
                <section id="7" className="space-y-8">
                    <h2 className="text-2xl font-bold border-b pb-2">7. よくある質問</h2>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Q1 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                会話がなかなか起こりません
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                会話は、住人たちが起きている時間帯に自然に始まります。<br />
                                その時々で頻度が変わるため、<br />
                                会話が多い賑やかな日もあれば、少し静かな日もあります。
                            </p>
                            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded mt-2">
                                <p>※「丸一日会話がなかった」という場合は、不具合の可能性があります。</p>
                                <p>もしよろしければ、連絡フォームより報告をお願いします。</p>
                            </div>
                        </div>

                        {/* Q2 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                相談が届きません
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                相談はたまに届きます。<br />
                                住人の信頼度などによっては、しばらく届かないこともありますが、特別な操作をしなくても自然に発生します。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                気長に待ってみましょう。
                            </p>
                        </div>

                        {/* Q3 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                新聞が更新されません
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                新聞は、1日の始まりに自動で更新されます。<br />
                                更新は、「設定」で登録された区切りの時刻に行われます。
                            </p>
                        </div>

                        {/* Q4 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                データは自動で保存されていますか？
                            </h3>
                            <p className="text-sm text-muted-foreground font-bold">
                                はい。
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                住人の登録や相談の回答など、ゲーム内での操作は<br />
                                すべて自動的にオンラインに保存されます。
                            </p>
                            <p className="text-sm text-muted-foreground">
                                画面上部に「同期済み」と表示されていれば問題ありません。
                            </p>
                        </div>

                        {/* Q5 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                オフラインでも遊べますか？
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                短時間であれば可能です。<br />
                                オフラインの間に行った操作は後で同期されますが、<br />
                                長時間オフラインが続く場合は反映されないことがあります。
                            </p>
                        </div>

                        {/* Q6 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                登録した情報は後から変更できますか？
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                名前や性格などの情報は、住人の編集画面からいつでも変更できます。
                            </p>
                        </div>

                        {/* Q7 */}
                        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-3 md:col-span-2">
                            <h3 className="font-bold text-base text-primary flex items-start gap-2">
                                <span className="select-none">Q.</span>
                                住人同士の関係はどうやって変わるのですか？
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                関係や印象は、住人どうしの会話などがきっかけで少しずつ変化していきます。<br />
                                直接操作することはできませんが、会話のきっかけを作るなど、間接的に介入することは可能です。
                            </p>
                        </div>
                    </div>

                </section>

                </div>
            </OfficePanelShell>
        </DeskPanel>
    );
}
