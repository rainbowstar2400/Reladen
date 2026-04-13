// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    ready: true,
    user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  },
  profileState: {
    data: { onboarding_completed: false } as { onboarding_completed?: boolean } | null,
  },
  startConversationScheduler: vi.fn(() => ({ stop: vi.fn() })),
  startConsultScheduler: vi.fn(() => ({ stop: vi.fn() })),
  startWeatherScheduler: vi.fn(() => ({ stop: vi.fn() })),
  startDailyScheduler: vi.fn(() => ({ stop: vi.fn() })),
  triggerConversationNow: vi.fn(),
  ensureUserPresetBootstrap: vi.fn(),
}));

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('@/lib/data/player-profile', () => ({
  usePlayerProfile: () => mocks.profileState,
}));

vi.mock('@/lib/scheduler/conversation-scheduler', () => ({
  startConversationScheduler: mocks.startConversationScheduler,
  triggerConversationNow: mocks.triggerConversationNow,
}));

vi.mock('@/lib/scheduler/consult-scheduler', () => ({
  startConsultScheduler: mocks.startConsultScheduler,
}));

vi.mock('@/lib/scheduler/weather-scheduler', () => ({
  startWeatherScheduler: mocks.startWeatherScheduler,
}));

vi.mock('@/lib/scheduler/daily-scheduler', () => ({
  startDailyScheduler: mocks.startDailyScheduler,
}));

vi.mock('@/lib/data/presets', () => ({
  ensureUserPresetBootstrap: mocks.ensureUserPresetBootstrap,
}));

vi.mock('@/lib/db-cloud/supabase', () => ({
  supabaseClient: null,
}));

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/query-client-provider', () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Providers } from '@/app/providers';
import { useSync } from '@/lib/sync/use-sync';

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function SyncProbe() {
  const sync = useSync();
  return <p data-testid="sync-phase">{sync.phase}</p>;
}

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNavigatorOnline(true);
    mocks.authState.ready = true;
    mocks.authState.user = { id: '11111111-1111-4111-8111-111111111111' };
    mocks.profileState.data = { onboarding_completed: false };
    mocks.ensureUserPresetBootstrap.mockResolvedValue(undefined);
  });

  it('Providers 配下で useSync() が使える', async () => {
    render(
      <Providers>
        <SyncProbe />
      </Providers>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('sync-phase')).toBeInTheDocument();
    });
  });

  it('onboarding_completed=false の間は scheduler を起動しない', async () => {
    render(
      <Providers>
        <div>child</div>
      </Providers>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startConversationScheduler).not.toHaveBeenCalled();
    expect(mocks.startConsultScheduler).not.toHaveBeenCalled();
    expect(mocks.startWeatherScheduler).not.toHaveBeenCalled();
    expect(mocks.startDailyScheduler).not.toHaveBeenCalled();
  });

  it('onboarding_completed=true になったら scheduler を起動する', async () => {
    const view = render(
      <Providers>
        <div>child</div>
      </Providers>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    mocks.profileState.data = { onboarding_completed: true };
    view.rerender(
      <Providers>
        <div>child</div>
      </Providers>,
    );

    await waitFor(() => {
      expect(mocks.startConversationScheduler).toHaveBeenCalledTimes(1);
      expect(mocks.startConsultScheduler).toHaveBeenCalledTimes(1);
      expect(mocks.startWeatherScheduler).toHaveBeenCalledTimes(1);
      expect(mocks.startDailyScheduler).toHaveBeenCalledTimes(1);
    });
  });
});
