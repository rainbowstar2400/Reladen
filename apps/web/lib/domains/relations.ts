// apps/web/lib/domain/relations.ts
import type { Relation } from '@/../../packages/shared/types';

export async function listRelations(): Promise<Relation[]> {
  // TODO
  return [];
}

export async function upsertRelation(_a: string, _b: string, _label: string): Promise<Relation> {
  // TODO: A-B を更新したら B-A も同期する実装にする
  return {} as Relation;
}
