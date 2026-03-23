import { describe, expect, it, vi } from 'vitest';
import { applyPushAck } from '@/lib/sync/push-ack';

describe('applyPushAck', () => {
  it('pushResult がある場合は index 対応で markSent / markFailed を分離する', async () => {
    const markSentFn = vi.fn(async () => {});
    const markFailedFn = vi.fn(async () => {});

    await applyPushAck({
      merged: [
        { __key: 'presets:id-0' },
        {},
        { __key: 'presets:id-2' },
        { __key: 'presets:id-3' },
      ],
      payload: {
        changes: [],
        pushResult: {
          consumedIndexes: [0, 1, 2, 3],
          rejected: [{ index: 2, reason: 'invalid_updated_at' }],
        },
      },
      markSentFn,
      markFailedFn,
    });

    expect(markFailedFn).toHaveBeenCalledTimes(1);
    expect(markFailedFn).toHaveBeenCalledWith(['presets:id-2'], 'invalid_updated_at');
    expect(markSentFn).toHaveBeenCalledTimes(1);
    expect(markSentFn).toHaveBeenCalledWith(['presets:id-0', 'presets:id-3']);
  });

  it('pushResult がない場合は既存フォールバックで markSent する', async () => {
    const markSentFn = vi.fn(async () => {});
    const markFailedFn = vi.fn(async () => {});

    await applyPushAck({
      merged: [{ __key: 'feelings:id-1' }, { __key: 'feelings:id-2' }],
      payload: {
        changes: [
          { data: { id: 'id-1' }, updated_at: '2026-03-20T00:00:00.000Z' },
        ],
      },
      markSentFn,
      markFailedFn,
    });

    expect(markSentFn).toHaveBeenCalledTimes(1);
    expect(markSentFn).toHaveBeenCalledWith(['feelings:id-1', 'feelings:id-2']);
    expect(markFailedFn).not.toHaveBeenCalled();
  });

  it('pushResult がなく changes が空なら markSent しない', async () => {
    const markSentFn = vi.fn(async () => {});
    const markFailedFn = vi.fn(async () => {});

    await applyPushAck({
      merged: [{ __key: 'relations:id-1' }],
      payload: {
        changes: [],
      },
      markSentFn,
      markFailedFn,
    });

    expect(markSentFn).not.toHaveBeenCalled();
    expect(markFailedFn).not.toHaveBeenCalled();
  });
});
