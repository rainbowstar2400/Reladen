import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

export async function POST() {
  const now = new Date().toISOString();
  const residents = [
    { id: uuid(), name: 'アカリ', mbti: 'INFP', traits: { likes: ['紅茶'], hobby: '散歩' }, updated_at: now, deleted: false },
    { id: uuid(), name: 'リク', mbti: 'ENTJ', traits: { likes: ['バトル'], hobby: 'トレーニング' }, updated_at: now, deleted: false },
  ];

  const relations = [
    {
      id: uuid(),
      a_id: residents[0].id < residents[1].id ? residents[0].id : residents[1].id,
      b_id: residents[0].id < residents[1].id ? residents[1].id : residents[0].id,
      type: 'friend',
      updated_at: now,
      deleted: false,
    },
  ];

  const feelings = [
    { id: uuid(), from_id: residents[0].id, to_id: residents[1].id, label: 'curious', updated_at: now, deleted: false },
    { id: uuid(), from_id: residents[1].id, to_id: residents[0].id, label: 'like', updated_at: now, deleted: false },
  ];

  const events = [
    {
      id: uuid(),
      kind: 'seed_created',
      payload: { residents: residents.map((r) => r.name) },
      updated_at: now,
      deleted: false,
    },
  ];

  (globalThis as any).__reladenSyncStore = new Map([
    ['residents', new Map(residents.map((item) => [item.id, item]))],
    ['relations', new Map(relations.map((item) => [item.id, item]))],
    ['feelings', new Map(feelings.map((item) => [item.id, item]))],
    ['events', new Map(events.map((item) => [item.id, item]))],
  ]);

  return NextResponse.json({
    ok: true,
    counts: {
      residents: residents.length,
      relations: relations.length,
      feelings: feelings.length,
      events: events.length,
    },
  });
}
