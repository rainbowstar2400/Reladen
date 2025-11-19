import { MotionMain } from '@/components/layout/motion-main';

export default function HowToPlayPage() {
    return (
        <MotionMain>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">遊び方</h1>
                <p>このページでは、ゲームの基本的なプレイガイドを説明します。</p>

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

                <section id="4" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">4章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>

                <section id="5" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">5章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>

                <section id="6" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">6章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>

                <section id="7" className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold">7章見出し</h2>
                    <p className="text-muted-foreground">テキスト</p>
                </section>
            </div>

        </MotionMain>
    );
}