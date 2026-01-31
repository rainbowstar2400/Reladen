'use client';

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResidentForm } from '@/components/forms/resident-form';
import { useRouter } from 'next/navigation';
import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';

export default function NewResidentPage() {
  const router = useRouter();

  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficePanelShell title="住人を追加">
        <div className="space-y-4">
          <CardHeader className="px-0">
            <CardTitle>住人を追加</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ResidentForm onSubmitted={() => router.push('/office/residents')} />
          </CardContent>
        </div>
      </OfficePanelShell>
    </DeskPanel>
  );
}
