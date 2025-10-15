type TableName = 'residents' | 'relations' | 'feelings' | 'events';

export type SyncEntity = {
  id: string;
  updated_at: string;
  deleted?: boolean;
} & Record<string, unknown>;

type SyncStoreInit = Partial<Record<TableName, Iterable<[string, SyncEntity]>>>;

type SyncTables = Record<TableName, Map<string, SyncEntity>>;

export class SyncStore {
  private readonly tables: SyncTables;

  constructor(initial?: SyncStoreInit) {
    this.tables = {
      residents: new Map(initial?.residents ?? []),
      relations: new Map(initial?.relations ?? []),
      feelings: new Map(initial?.feelings ?? []),
      events: new Map(initial?.events ?? []),
    };
  }

  has(key: string): key is TableName {
    return key in this.tables;
  }

  get<K extends TableName>(key: K): SyncTables[K] {
    return this.tables[key];
  }
}
