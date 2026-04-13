import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sbServer: vi.fn(),
  setSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  sbServer: mocks.sbServer,
}));

import { POST } from '@/app/api/auth/callback/route';

function makeRequest(body: unknown, origin?: string, requestUrl = 'http://localhost/api/auth/callback') {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (origin) headers.set('Origin', origin);
  return new Request(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string, origin?: string, requestUrl = 'http://localhost/api/auth/callback') {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (origin) headers.set('Origin', origin);
  return new Request(requestUrl, {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sbServer.mockReturnValue({
      auth: {
        setSession: mocks.setSession,
        signOut: mocks.signOut,
      },
    });
  });

  it('Origin が無い場合は 403 を返す', async () => {
    const res = await POST(makeRequest({ event: 'SIGNED_IN', session: null }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'forbidden' });
    expect(mocks.sbServer).not.toHaveBeenCalled();
  });

  it('Origin が不一致の場合は 403 を返す', async () => {
    const res = await POST(
      makeRequest({ event: 'SIGNED_IN', session: null }, 'https://evil.example.com'),
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'forbidden' });
    expect(mocks.sbServer).not.toHaveBeenCalled();
  });

  it('不正な body の場合は 400 を返す', async () => {
    const res = await POST(makeRawRequest('{', 'http://localhost'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ ok: false, reason: 'invalid body' });
    expect(mocks.sbServer).not.toHaveBeenCalled();
  });

  it('未対応 event の場合は 400 を返す', async () => {
    const res = await POST(makeRequest({ event: 'USER_UPDATED', session: null }, 'http://localhost'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ ok: false, reason: 'unsupported event' });
    expect(mocks.sbServer).not.toHaveBeenCalled();
  });

  it('Origin 一致 + SIGNED_IN で setSession を実行する', async () => {
    const session = {
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
      },
    } as any;

    const previewUrl = 'https://reladen-preview-abc123.vercel.app/api/auth/callback';
    const res = await POST(
      makeRequest({ event: 'SIGNED_IN', session }, 'https://reladen-preview-abc123.vercel.app', previewUrl),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mocks.setSession).toHaveBeenCalledWith(session);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('Origin 一致 + SIGNED_OUT で signOut を実行する', async () => {
    const res = await POST(makeRequest({ event: 'SIGNED_OUT', session: null }, 'http://localhost'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
