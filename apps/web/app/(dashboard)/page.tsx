import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SyncIndicator } from '@/components/sync-indicator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ようこそ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            左のナビゲーションから住人・関係・感情・イベントの各画面へ移動できます。オフラインでも編集可能で、ネットワーク復帰後に自動同期されます。
          </p>
          <SyncIndicator />
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/residents">住人一覧を開く</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/events">イベントログを見る</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
