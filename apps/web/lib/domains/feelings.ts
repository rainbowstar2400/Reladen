// apps/web/lib/domain/feelings.ts
import type { Feeling } from '@/../../packages/shared/types';

export async function listFeelings(): Promise<Feeling[]> {
  // TODO
  return [];
}

export async function upsertFeeling(_from: string, _to: string, _label: string): Promise<Feeling> {
  // TODO
  return {} as Feeling;
}
