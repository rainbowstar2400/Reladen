// apps/web/scripts/seed-conversation-demo.ts
import { putLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';

async function main() {
  const now = new Date().toISOString();
  const a = '11111111-1111-1111-1111-111111111111'; // 既存ResidentのUUIDに置換
  const b = '22222222-2222-2222-2222-222222222222'; // 既存ResidentのUUIDに置換
  const threadId = newId();

  const eventId = newId();
  await putLocal('events', {
    id: eventId,
    kind: 'conversation',
    updated_at: now,
    deleted: false,
    payload: {
      threadId,
      participants: [a, b],
      topic: 'movie',
      lines: [
        { speaker: a, text: '昨日の映画、良かったね。' },
        { speaker: b, text: 'うん、教えてくれて助かったよ。' },
      ],
      meta: {
        tags: ['共感', '感謝', '軽い雑談'],
        newKnowledge: [{ target: b, key: 'likes.movie.title:XXXX' }],
        signals: ['continue'],
      },
      deltas: {
        aToB: { favor: 1, impression: 1 },
        bToA: { favor: 1, impression: 0 },
      },
      systemLine: 'SYSTEM: A→B 好感度 +1 / 印象 ↑',
    },
  });

  await putLocal('topic_threads', {
    id: threadId,
    topic: 'movie',
    participants: [a, b],
    status: 'ongoing',
    lastEventId: eventId,
    updated_at: now,
    deleted: false,
  });

  await putLocal('notifications', {
    id: newId(),
    type: 'conversation',
    linkedEventId: eventId,
    threadId,
    participants: [a, b],
    snippet: 'AとBが映画の話をしている…',
    occurredAt: now,
    status: 'unread',
    priority: 0,
    updated_at: now,
  });

  console.log('Seeded demo conversation.');
}

void main();
