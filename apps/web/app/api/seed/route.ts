import { NextResponse } from 'next/server';
import { newId } from '@/lib/newId';
import { SyncStore, type SyncEntity } from '../sync/store';

export async function POST() {
  const now = new Date().toISOString();
  const residents = [
    { id: newId(), name: 'アカリ', mbti: 'INFP', traits: { likes: ['紅茶'], hobby: '散歩' }, updated_at: now, deleted: false },
    { id: newId(), name: 'リク', mbti: 'ENTJ', traits: { likes: ['バトル'], hobby: 'トレーニング' }, updated_at: now, deleted: false },
  ] satisfies SyncEntity[];

  const relations = [
    {
      id: newId(),
      a_id: residents[0].id < residents[1].id ? residents[0].id : residents[1].id,
      b_id: residents[0].id < residents[1].id ? residents[1].id : residents[0].id,
      type: 'friend',
      updated_at: now,
      deleted: false,
    },
  ] satisfies SyncEntity[];

  const feelings = [
    { id: newId(), from_id: residents[0].id, to_id: residents[1].id, label: 'curious', updated_at: now, deleted: false },
    { id: newId(), from_id: residents[1].id, to_id: residents[0].id, label: 'like', updated_at: now, deleted: false },
  ] satisfies SyncEntity[];

  const events = [
    {
      id: newId(),
      kind: 'seed_created',
      payload: { residents: residents.map((r) => r.name) },
      updated_at: now,
      deleted: false,
    },
  ] satisfies SyncEntity[];

  const globalScope = globalThis as typeof globalThis & {
    __reladenSyncStore?: SyncStore;
  };

  globalScope.__reladenSyncStore = new SyncStore({
    residents: residents.map<[string, SyncEntity]>((item) => [item.id, item]),
    relations: relations.map<[string, SyncEntity]>((item) => [item.id, item]),
    feelings: feelings.map<[string, SyncEntity]>((item) => [item.id, item]),
    events: events.map<[string, SyncEntity]>((item) => [item.id, item]),
  });

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
