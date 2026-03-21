import { describe, expect, it } from 'vitest';
import type { EventLogStrict } from '@repo/shared/types/conversation';
import { filterReportTargetEvents } from '@/lib/reports/report-visibility';

const now = '2026-03-21T00:00:00.000Z';

function makeEvent(params: {
  id: string;
  kind: EventLogStrict['kind'];
  payload?: Record<string, unknown>;
}): EventLogStrict {
  return {
    id: params.id,
    kind: params.kind,
    payload: params.payload ?? {},
    updated_at: now,
    deleted: false,
  } as unknown as EventLogStrict;
}

describe('report-visibility', () => {
  it('回答済み相談のみを日報対象として残す', () => {
    const conversation = makeEvent({
      id: 'conv-1',
      kind: 'conversation',
      payload: { participants: ['a', 'b'], lines: [] },
    });
    const answeredConsult = makeEvent({
      id: 'consult-answered',
      kind: 'consult',
      payload: { selectedChoiceId: 'choice-a' },
    });
    const unansweredConsult = makeEvent({
      id: 'consult-unanswered',
      kind: 'consult',
      payload: { selectedChoiceId: null },
    });
    const other = makeEvent({ id: 'other-1', kind: 'relation_trigger' });

    const visible = filterReportTargetEvents([
      conversation,
      answeredConsult,
      unansweredConsult,
      other,
    ]);

    expect(visible.map((item) => item.id)).toEqual(['conv-1', 'consult-answered']);
  });

  it('未回答相談を含む場合に表示件数が減る', () => {
    const events = [
      makeEvent({ id: 'consult-1', kind: 'consult', payload: { selectedChoiceId: 'a' } }),
      makeEvent({ id: 'consult-2', kind: 'consult', payload: { selectedChoiceId: '' } }),
      makeEvent({ id: 'consult-3', kind: 'consult', payload: {} }),
      makeEvent({ id: 'conv-1', kind: 'conversation', payload: { participants: ['a', 'b'], lines: [] } }),
    ];

    const visible = filterReportTargetEvents(events);
    expect(visible).toHaveLength(2);
    expect(visible.map((item) => item.id)).toEqual(['consult-1', 'conv-1']);
  });
});
