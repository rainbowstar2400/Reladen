'use client';

import { useCallback } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';
import { usePlayerProfile, useUpsertPlayerProfile } from '@/lib/data/player-profile';
import { useResidents } from '@/lib/data/residents';
import { triggerConversationNow } from '@/lib/scheduler/conversation-scheduler';
import dynamic from 'next/dynamic';

const ResidentForm = dynamic(
  () => import('@/components/forms/resident-form').then((m) => m.ResidentForm),
  {
    loading: () => <div className="h-96 animate-pulse rounded-md bg-muted/40" />,
  },
);

export default function NewResidentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = usePlayerProfile();
  const { data: residents = [] } = useResidents();
  const upsertProfile = useUpsertPlayerProfile();

  const isTutorialMode = profile && !profile.onboarding_completed;
  const activeResidentCount = residents.filter((r) => !(r as any).deleted).length;

  const handleSubmitted = useCallback(async () => {
    // Invalidate to get fresh count
    await queryClient.invalidateQueries({ queryKey: ['residents'] });

    // Check if onboarding should complete (tutorial mode + 2+ residents after this registration)
    // activeResidentCount is stale (before this registration), so +1
    if (isTutorialMode && activeResidentCount + 1 >= 2) {
      try {
        await upsertProfile.mutateAsync({
          player_name: profile?.player_name || 'Player',
          onboarding_completed: true,
        });
        void triggerConversationNow({ force: true });
      } catch {
        // best-effort
      }
      router.push('/home');
    } else {
      router.push('/office/residents');
    }
  }, [isTutorialMode, activeResidentCount, upsertProfile, profile, router, queryClient]);

  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficePanelShell title="住人を追加">
        <div className="space-y-4">
          <CardHeader className="px-0">
            <CardTitle>住人を追加</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ResidentForm onSubmitted={handleSubmitted} />
          </CardContent>
        </div>
      </OfficePanelShell>
    </DeskPanel>
  );
}
