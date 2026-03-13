import { describe, expect, it } from 'vitest';
import { hasForeignSessionForSameUser } from '@/lib/consults/use-consult-presence-lock';

describe('hasForeignSessionForSameUser', () => {
  it('同一ユーザーに別sessionIdがあればロック扱い', () => {
    const locked = hasForeignSessionForSameUser(
      {
        user_1: [{ sessionId: 'tab-a' }, { sessionId: 'tab-b' }],
      },
      'user_1',
      'tab-a',
    );
    expect(locked).toBe(true);
  });

  it('同一sessionIdのみならロックしない', () => {
    const locked = hasForeignSessionForSameUser(
      {
        user_1: [{ sessionId: 'tab-a' }],
      },
      'user_1',
      'tab-a',
    );
    expect(locked).toBe(false);
  });

  it('他ユーザーのpresenceはロック条件にしない', () => {
    const locked = hasForeignSessionForSameUser(
      {
        user_2: [{ sessionId: 'tab-z' }],
      },
      'user_1',
      'tab-a',
    );
    expect(locked).toBe(false);
  });
});

