// apps/web/components/notifications/NotificationsSection.client.tsx
'use client';

import NotificationsPanel from './NotificationsPanel';
import DetailLayerInner from '@/components/logs/detail-layer.inner';

export default function NotificationsSectionClient() {
  return (
    <>
      <NotificationsPanel />
      {/* URLの ?log= を監視して既存の会話ダイアログを開く */}
      <DetailLayerInner />
    </>
  );
}
