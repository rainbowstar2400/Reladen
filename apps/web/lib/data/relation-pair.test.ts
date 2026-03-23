import { describe, expect, it } from 'vitest';
import type { Relation } from '@/types';
import { buildRelationDedupPlan, normalizeRelationPair, relationPairKey } from '@/lib/data/relation-pair';

const A_ID = '11111111-1111-4111-8111-111111111111';
const B_ID = '22222222-2222-4222-8222-222222222222';

function makeRelation(partial: Partial<Relation>): Relation {
  return {
    id: partial.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    a_id: partial.a_id ?? A_ID,
    b_id: partial.b_id ?? B_ID,
    type: partial.type ?? 'friend',
    family_sub_type: partial.family_sub_type ?? null,
    updated_at: partial.updated_at ?? '2026-03-21T00:00:00.000Z',
    deleted: partial.deleted ?? false,
  };
}

describe('relation-pair', () => {
  it('normalizeRelationPair は (A,B)/(B,A) を同一順序へ正規化する', () => {
    const forward = normalizeRelationPair(A_ID, B_ID);
    const reverse = normalizeRelationPair(B_ID, A_ID);

    expect(forward.aId).toBe(A_ID);
    expect(forward.bId).toBe(B_ID);
    expect(reverse.aId).toBe(A_ID);
    expect(reverse.bId).toBe(B_ID);
    expect(forward.key).toBe(reverse.key);
    expect(relationPairKey(A_ID, B_ID)).toBe(relationPairKey(B_ID, A_ID));
  });

  it('buildRelationDedupPlan は updated_at が最新の1件を正として残す', () => {
    const newer = makeRelation({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      a_id: B_ID,
      b_id: A_ID,
      updated_at: '2026-03-21T12:00:00.000Z',
      deleted: false,
    });
    const older = makeRelation({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      a_id: A_ID,
      b_id: B_ID,
      updated_at: '2026-03-20T12:00:00.000Z',
      deleted: false,
    });

    const plan = buildRelationDedupPlan([older, newer], '2026-03-21T13:00:00.000Z');
    const canonical = plan.canonicalByKey.get(relationPairKey(A_ID, B_ID));

    expect(canonical?.id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(plan.tombstones).toHaveLength(1);
    expect(plan.tombstones[0].id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(plan.tombstones[0].deleted).toBe(true);
    expect(plan.tombstones[0].a_id).toBe(A_ID);
    expect(plan.tombstones[0].b_id).toBe(B_ID);
    expect(plan.tombstones[0].updated_at).toBe('2026-03-21T13:00:00.000Z');
  });

  it('updated_at 同値時は id 昇順先頭を正として残す', () => {
    const highId = makeRelation({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      updated_at: '2026-03-21T12:00:00.000Z',
      deleted: false,
    });
    const lowId = makeRelation({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      updated_at: '2026-03-21T12:00:00.000Z',
      deleted: false,
    });

    const plan = buildRelationDedupPlan([highId, lowId], '2026-03-21T13:00:00.000Z');
    const canonical = plan.canonicalByKey.get(relationPairKey(A_ID, B_ID));

    expect(canonical?.id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(plan.tombstones).toHaveLength(1);
    expect(plan.tombstones[0].id).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  });

  it('異なるペアは独立して評価し、ペアごとに正1件へ収束する', () => {
    const C_ID = '33333333-3333-4333-8333-333333333333';
    const pair1A = makeRelation({
      id: '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      a_id: A_ID,
      b_id: B_ID,
      updated_at: '2026-03-20T00:00:00.000Z',
    });
    const pair1B = makeRelation({
      id: '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      a_id: B_ID,
      b_id: A_ID,
      updated_at: '2026-03-21T00:00:00.000Z',
    });
    const pair2A = makeRelation({
      id: '33333333-cccc-4ccc-8ccc-cccccccccccc',
      a_id: C_ID,
      b_id: A_ID,
      updated_at: '2026-03-21T01:00:00.000Z',
    });

    const plan = buildRelationDedupPlan([pair1A, pair1B, pair2A], '2026-03-21T02:00:00.000Z');

    expect(plan.canonicalByKey.size).toBe(2);
    expect(plan.canonicalByKey.get(relationPairKey(A_ID, B_ID))?.id).toBe('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(plan.canonicalByKey.get(relationPairKey(A_ID, C_ID))?.id).toBe('33333333-cccc-4ccc-8ccc-cccccccccccc');
    expect(plan.tombstones).toHaveLength(1);
    expect(plan.tombstones[0].id).toBe('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});

