import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listLocal: vi.fn(),
  putLocal: vi.fn(),
  getLocal: vi.fn(),
  markDeleted: vi.fn(),
  removeLocal: vi.fn(),
  newId: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/db-local', () => ({
  listLocal: mocks.listLocal,
  putLocal: mocks.putLocal,
  getLocal: mocks.getLocal,
  markDeleted: mocks.markDeleted,
  removeLocal: mocks.removeLocal,
}));

vi.mock('@/lib/newId', () => ({
  newId: mocks.newId,
}));

vi.mock('@/lib/db-cloud/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import { DEFAULT_PRESETS, DEFAULT_PRESETS_VERSION, ensureUserPresetBootstrap } from '@/lib/data/presets';

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('ensureUserPresetBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (globalThis as any).window = {
      localStorage: createStorage(),
    };

    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: USER_ID } } },
      error: null,
    });

    let seq = 0;
    mocks.newId.mockImplementation(() => {
      seq += 1;
      return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
    });
  });

  it('初回実行でテンプレート分のユーザー所有プリセットを作成し、2回目は何もしない', async () => {
    let presets: Array<Record<string, any>> = [];
    let residents: Array<Record<string, any>> = [];

    mocks.listLocal.mockImplementation(async (table: string) => {
      if (table === 'presets') return presets;
      if (table === 'residents') return residents;
      return [];
    });

    mocks.putLocal.mockImplementation(async (table: string, value: any) => {
      if (table === 'presets') {
        const i = presets.findIndex((item) => item.id === value.id);
        if (i >= 0) presets[i] = value;
        else presets.push(value);
      }
      if (table === 'residents') {
        const i = residents.findIndex((item) => item.id === value.id);
        if (i >= 0) residents[i] = value;
        else residents.push(value);
      }
      return value;
    });

    mocks.removeLocal.mockImplementation(async (table: string, id: string) => {
      if (table !== 'presets') return;
      presets = presets.filter((item) => item.id !== id);
    });

    const legacyIds = new Set(DEFAULT_PRESETS.map((preset) => preset.id));

    await ensureUserPresetBootstrap(USER_ID);

    expect(presets).toHaveLength(DEFAULT_PRESETS.length);
    expect(presets.every((preset) => !legacyIds.has(preset.id))).toBe(true);

    const markerKey = `reladen:preset-bootstrap:${USER_ID}:v${DEFAULT_PRESETS_VERSION}`;
    expect(window.localStorage.getItem(markerKey)).toBe('1');

    const putCount = mocks.putLocal.mock.calls.length;
    await ensureUserPresetBootstrap(USER_ID);
    expect(mocks.putLocal.mock.calls.length).toBe(putCount);
  });

  it('旧固定IDプリセットを新IDへ移行し、resident参照を更新して旧行を削除する', async () => {
    const legacy = DEFAULT_PRESETS[0];
    const legacyId = legacy.id;

    let presets: Array<Record<string, any>> = [
      {
        ...legacy,
        description: '編集済みの説明',
        owner_id: 'SYSTEM',
      },
    ];
    let residents: Array<Record<string, any>> = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'テスト住人',
        speech_preset: legacyId,
        occupation: null,
        first_person: null,
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted: false,
      },
    ];

    mocks.listLocal.mockImplementation(async (table: string) => {
      if (table === 'presets') return presets;
      if (table === 'residents') return residents;
      return [];
    });

    mocks.putLocal.mockImplementation(async (table: string, value: any) => {
      if (table === 'presets') {
        const i = presets.findIndex((item) => item.id === value.id);
        if (i >= 0) presets[i] = value;
        else presets.push(value);
      }
      if (table === 'residents') {
        const i = residents.findIndex((item) => item.id === value.id);
        if (i >= 0) residents[i] = value;
        else residents.push(value);
      }
      return value;
    });

    mocks.removeLocal.mockImplementation(async (table: string, id: string) => {
      if (table !== 'presets') return;
      presets = presets.filter((item) => item.id !== id);
    });

    await ensureUserPresetBootstrap(USER_ID);

    const copied = presets.find(
      (preset) =>
        preset.category === legacy.category &&
        preset.label === legacy.label &&
        preset.id !== legacyId,
    );
    expect(copied).toBeTruthy();
    expect(copied?.description).toBe('編集済みの説明');
    expect(residents[0].speech_preset).toBe(copied?.id);
    expect(presets.some((preset) => preset.id === legacyId)).toBe(false);
    expect(mocks.removeLocal).toHaveBeenCalledWith('presets', legacyId);
  });
});

