import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';

export default function SpecsPage() {
    return (
        <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
            <OfficePanelShell showTitle={false}>
                <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">仕様説明</h1>
                <p>このページでは、本アプリケーションのシステム仕様や技術的な詳細を説明します。**この項目はサイドバーでは目立たないように表示されます。**</p>

                <section id="1" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">1章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>

                <section id="2" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">2章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>

                <section id="3" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">3章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>
                </div>
            </OfficePanelShell>
        </DeskPanel>
    );
}
