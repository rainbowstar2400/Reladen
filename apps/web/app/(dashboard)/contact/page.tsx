import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';

export default function Contact() {
  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficePanelShell showTitle={false}>
        <p className="text-sm text-muted-foreground">
          連絡フォーム：外部リンクを設定してください（NEXT_PUBLIC_CONTACT_URL）
        </p>
      </OfficePanelShell>
    </DeskPanel>
  );
}
