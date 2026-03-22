import type { SyncPayload } from '@/types';

type PendingMergedRow = {
  __key?: string;
};

type PushResult = NonNullable<SyncPayload['pushResult']>;

function toOutboxKey(merged: PendingMergedRow[], index: number): string | null {
  if (index < 0 || index >= merged.length) return null;
  const key = merged[index]?.__key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function uniqueKeys(keys: string[]): string[] {
  return [...new Set(keys)];
}

export function buildPushResultAckPlan(merged: PendingMergedRow[], pushResult: PushResult) {
  const rejectedByReason = new Map<string, Set<string>>();
  const rejectedKeys = new Set<string>();

  for (const rejected of pushResult.rejected) {
    const key = toOutboxKey(merged, rejected.index);
    if (!key) continue;
    const reason = rejected.reason || 'rejected';
    if (!rejectedByReason.has(reason)) {
      rejectedByReason.set(reason, new Set<string>());
    }
    rejectedByReason.get(reason)!.add(key);
    rejectedKeys.add(key);
  }

  const sentKeys: string[] = [];
  for (const index of pushResult.consumedIndexes) {
    const key = toOutboxKey(merged, index);
    if (!key) continue;
    if (rejectedKeys.has(key)) continue;
    sentKeys.push(key);
  }

  return {
    sentKeys: uniqueKeys(sentKeys),
    failedByReason: [...rejectedByReason.entries()].map(([reason, keys]) => ({
      reason,
      keys: [...keys],
    })),
  };
}

export function buildLegacyAckPlan(merged: PendingMergedRow[], cloudChangesCount: number) {
  if (cloudChangesCount <= 0) return { sentKeys: [] as string[] };
  const sentKeys = merged
    .filter((m) => typeof m.__key === 'string' && m.__key.length > 0)
    .map((m) => m.__key!) as string[];
  return { sentKeys: uniqueKeys(sentKeys) };
}

export async function applyPushAck(params: {
  merged: PendingMergedRow[];
  payload: Pick<SyncPayload, 'pushResult' | 'changes'>;
  markSentFn: (keys: string[]) => Promise<void>;
  markFailedFn: (keys: string[], reason: string) => Promise<void>;
}) {
  const { merged, payload, markSentFn, markFailedFn } = params;

  if (payload.pushResult) {
    const plan = buildPushResultAckPlan(merged, payload.pushResult);
    for (const failed of plan.failedByReason) {
      if (failed.keys.length > 0) {
        await markFailedFn(failed.keys, failed.reason);
      }
    }
    if (plan.sentKeys.length > 0) {
      await markSentFn(plan.sentKeys);
    }
    return;
  }

  const legacyPlan = buildLegacyAckPlan(merged, payload.changes.length);
  if (legacyPlan.sentKeys.length > 0) {
    await markSentFn(legacyPlan.sentKeys);
  }
}
