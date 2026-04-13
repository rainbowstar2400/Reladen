import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extractSpeechProfile: vi.fn(),
  getUserOrThrow: vi.fn(),
}));

vi.mock('@/lib/gpt/extract-speech-profile', () => ({
  extractSpeechProfile: mocks.extractSpeechProfile,
}));

vi.mock('@/lib/supabase/get-user', () => ({
  getUserOrThrow: mocks.getUserOrThrow,
}));

import { POST } from '@/app/api/presets/extract-speech-profile/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/presets/extract-speech-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/presets/extract-speech-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserOrThrow.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
  });

  it('未認証時は 401 を返す', async () => {
    mocks.getUserOrThrow.mockRejectedValue(new Error('No authenticated user found'));

    const res = await POST(
      makeRequest({
        label: '丁寧',
        description: '丁寧で穏やかな話し方',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'unauthenticated' });
    expect(mocks.extractSpeechProfile).not.toHaveBeenCalled();
  });

  it('認証済みなら抽出結果を返す', async () => {
    mocks.extractSpeechProfile.mockResolvedValue({
      summary: '落ち着いた口調',
      traits: ['soft'],
    });

    const res = await POST(
      makeRequest({
        label: '丁寧',
        description: '丁寧で穏やかな話し方',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      summary: '落ち着いた口調',
      traits: ['soft'],
    });
    expect(mocks.extractSpeechProfile).toHaveBeenCalledTimes(1);
  });
});
