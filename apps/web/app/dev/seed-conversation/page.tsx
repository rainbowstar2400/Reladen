'use client';
import { createConversationEvent } from '@/lib/repos/conversation-repo';

export default function SeedConversationPage() {
  async function handleCreate() {
    const payload = {
      threadId: 'demo-thread',
      participants: ['1111', '2222'],
      lines: [
        { speaker: '1111', text: 'おはよう！今日も頑張ろう。' },
        { speaker: '2222', text: 'うん、天気もいいしね。' },
      ],
      deltas: {
        aToB: { favor: 1, impression: 1 },
        bToA: { favor: 1, impression: 0 },
      },
      systemLine: 'SYSTEM: A→B 好感度 +1 / 印象 ↑',
      meta: {},
    };
    await createConversationEvent(payload as any);
    alert('会話を生成しました。ダッシュボードのお知らせを確認してください。');
  }

  return (
    <div className="p-6">
      <button
        onClick={handleCreate}
        className="rounded-xl border px-4 py-2 shadow hover:bg-gray-50"
      >
        テスト会話を生成
      </button>
    </div>
  );
}
