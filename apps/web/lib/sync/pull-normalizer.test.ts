import { describe, expect, it } from 'vitest';
import { normalizePulledRow } from '@/lib/sync/pull-normalizer';

describe('normalizePulledRow', () => {
  it('一般テーブルで snake_case を保持しつつ camelCase を補完する', () => {
    const input = {
      id: 'row-1',
      updated_at: '2026-03-14T00:00:00.000Z',
      trust_to_player: 55,
      payload: {
        selected_choice_id: 'nested-value',
      },
    };

    const normalized = normalizePulledRow('residents', input);

    expect(normalized.updated_at).toBe('2026-03-14T00:00:00.000Z');
    expect(normalized.updatedAt).toBe('2026-03-14T00:00:00.000Z');
    expect(normalized.trust_to_player).toBe(55);
    expect(normalized.trustToPlayer).toBe(55);
    expect(normalized.payload).toEqual({
      selected_choice_id: 'nested-value',
    });
  });

  it('既存の camelCase キーは上書きしない', () => {
    const input = {
      updated_at: 'snake',
      updatedAt: 'camel',
    };

    const normalized = normalizePulledRow('events', input);

    expect(normalized.updated_at).toBe('snake');
    expect(normalized.updatedAt).toBe('camel');
  });

  it('consult_answers の compact/snake 混在を3系統へ補完する', () => {
    const input = {
      id: 'consult-1',
      selected_choice_id: 'choice_snake',
      selectedchoiceid: 'choice_compact',
      decidedat: '2026-03-14T01:00:00.000Z',
      updated_at: '2026-03-14T01:00:00.000Z',
    };

    const normalized = normalizePulledRow('consult_answers', input);

    // 優先順: camel > snake > compact
    expect(normalized.selectedChoiceId).toBe('choice_snake');
    expect(normalized.selected_choice_id).toBe('choice_snake');
    expect(normalized.selectedchoiceid).toBe('choice_snake');
    expect(normalized.decidedAt).toBe('2026-03-14T01:00:00.000Z');
    expect(normalized.decided_at).toBe('2026-03-14T01:00:00.000Z');
    expect(normalized.decidedat).toBe('2026-03-14T01:00:00.000Z');
    expect(normalized.updatedAt).toBe('2026-03-14T01:00:00.000Z');
  });
});

