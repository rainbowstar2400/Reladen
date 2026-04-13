// @vitest-environment jsdom
import React, { type ReactNode } from 'react';
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TABLE_COUNT = 9;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  since: vi.fn(),
  bulkUpsert: vi.fn(),
  listPendingByTable: vi.fn(),
  markSent: vi.fn(),
  markFailed: vi.fn(),
  applyPushAck: vi.fn(),
  normalizePulledRow: vi.fn(),
  useSettings: vi.fn(),
  realtimeCallbacks: [] as Array<() => void>,
}));

vi.mock('@/lib/db-cloud/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock('@/lib/db-local', () => ({
  since: mocks.since,
  bulkUpsert: mocks.bulkUpsert,
}));

vi.mock('@/lib/sync/outbox', () => ({
  makeOutboxKey: (table: string, id: string) => `${table}:${id}`,
  listPendingByTable: mocks.listPendingByTable,
  markSent: mocks.markSent,
  markFailed: mocks.markFailed,
}));

vi.mock('@/lib/sync/push-ack', () => ({
  applyPushAck: mocks.applyPushAck,
}));

vi.mock('@/lib/sync/pull-normalizer', () => ({
  normalizePulledRow: mocks.normalizePulledRow,
}));

vi.mock('@/lib/use-settings', () => ({
  useSettings: mocks.useSettings,
}));

import { SyncProvider, useSync } from '@/lib/sync/use-sync';

const fetchMock = vi.fn();

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function tableFromInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input.split('/').pop() ?? 'residents';
  }
  if (input instanceof URL) {
    return input.pathname.split('/').pop() ?? 'residents';
  }
  return input.url.split('/').pop() ?? 'residents';
}

function makeSyncResponse(input: RequestInfo | URL): Response {
  const table = tableFromInput(input);
  return new Response(
    JSON.stringify({
      table,
      changes: [],
      pushResult: { consumedIndexes: [], rejected: [] },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function flushMicrotasks(times = 20) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function requestBodyAt(index: number) {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  const body = init?.body;
  if (typeof body !== 'string') return {};
  return JSON.parse(body) as Record<string, unknown>;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  return <SyncProvider>{children}</SyncProvider>;
}

describe('useSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.realtimeCallbacks.length = 0;

    setNavigatorOnline(true);
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockImplementation((input: RequestInfo | URL) => Promise.resolve(makeSyncResponse(input)));
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.channel.mockImplementation(() => {
      type ChannelMock = {
        on: (event: string, filter: unknown, callback: () => void) => ChannelMock;
        subscribe: () => ChannelMock;
      };
      let current!: ChannelMock;
      current = {
        on: vi.fn((_event: string, _filter: unknown, callback: () => void) => {
          mocks.realtimeCallbacks.push(callback);
          return current;
        }),
        subscribe: vi.fn(() => current),
      };
      return current;
    });
    mocks.removeChannel.mockResolvedValue(undefined);
    mocks.since.mockResolvedValue([]);
    mocks.bulkUpsert.mockResolvedValue(undefined);
    mocks.listPendingByTable.mockResolvedValue([]);
    mocks.markSent.mockResolvedValue(undefined);
    mocks.markFailed.mockResolvedValue(undefined);
    mocks.applyPushAck.mockResolvedValue(undefined);
    mocks.normalizePulledRow.mockImplementation((_table: string, data: unknown) => data);
    mocks.useSettings.mockReturnValue({
      s: { syncEnabled: true },
      setS: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('SyncProvider の外で useSync() を呼ぶと throw する', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSync())).toThrowError('useSync must be used within <SyncProvider>');
    errorSpy.mockRestore();
  });

  it('SyncProvider 内の複数コンポーネントが同じ sync 状態を共有する', async () => {
    type SyncState = ReturnType<typeof useSync>;
    const seen: { first: SyncState | null; second: SyncState | null } = {
      first: null,
      second: null,
    };

    function FirstConsumer() {
      seen.first = useSync();
      return null;
    }

    function SecondConsumer() {
      seen.second = useSync();
      return null;
    }

    render(
      <SyncProvider>
        <FirstConsumer />
        <SecondConsumer />
      </SyncProvider>,
    );

    await waitFor(() => {
      expect(seen.first).not.toBeNull();
      expect(seen.second).not.toBeNull();
    });
    expect(seen.first).toBe(seen.second);
  });

  it('requestDebouncedSync は最新の syncAll を参照する', async () => {
    vi.useFakeTimers();
    renderHook(() => useSync(), { wrapper });

    expect(mocks.realtimeCallbacks.length).toBeGreaterThan(0);

    act(() => {
      mocks.realtimeCallbacks[0]?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(TABLE_COUNT);
    const firstBody = requestBodyAt(0);
    expect(firstBody).not.toHaveProperty('since');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });

    act(() => {
      mocks.realtimeCallbacks[0]?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(TABLE_COUNT * 2);
    const secondBody = requestBodyAt(TABLE_COUNT);
    expect(secondBody.since).toEqual(expect.any(String));
  });

  it('lastSyncedAt=null の初回 syncAll は since 未指定で送信される', async () => {
    const { result } = renderHook(() => useSync(), { wrapper });

    await act(async () => {
      await result.current.sync();
    });

    expect(fetchMock).toHaveBeenCalled();
    const firstBody = requestBodyAt(0);
    expect(firstBody).not.toHaveProperty('since');
  });

  it('offline -> online -> syncing -> online/error の phase 遷移が正しい', async () => {
    vi.useFakeTimers();
    setNavigatorOnline(false);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useSync(), { wrapper });

    expect(result.current.phase).toBe('offline');

    setNavigatorOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.phase).toBe('online');

    const deferred = createDeferred<Response>();
    let callCount = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      callCount += 1;
      if (callCount === 1) return deferred.promise;
      return Promise.resolve(makeSyncResponse(input));
    });

    let syncPromise!: Promise<unknown>;
    await act(async () => {
      syncPromise = result.current.sync();
      await Promise.resolve();
    });
    expect(result.current.phase).toBe('syncing');

    deferred.resolve(makeSyncResponse('/api/sync/presets'));
    await act(async () => {
      await syncPromise;
    });
    expect(result.current.phase).toBe('online');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      const syncResult = await result.current.sync();
      expect(syncResult).toEqual({ ok: false, reason: 'error', message: 'network down' });
    });
    expect(result.current.phase).toBe('error');

    errorSpy.mockRestore();
  });
});
