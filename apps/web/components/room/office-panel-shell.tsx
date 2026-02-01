'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDeskTransition } from '@/components/room/room-transition-context';

type OfficePanelShellProps = {
  title?: string;
  showTitle?: boolean;
  showBack?: boolean;
  backLabel?: string;
  children: ReactNode;
};

export function OfficePanelShell({
  title,
  showTitle = true,
  showBack = true,
  backLabel = '管理室トップへ',
  children,
}: OfficePanelShellProps) {
  const router = useRouter();
  const deskTransition = useDeskTransition();

  const navigateDesk = (href: string, target: 'home' | 'desk') => {
    const delay = deskTransition?.beginDeskTransition(target) ?? 0;
    window.setTimeout(() => {
      router.push(href);
    }, delay);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          className="h-10 rounded-xl text-sm"
          onClick={() => navigateDesk('/home', 'home')}
        >
          ホームに戻る
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-xl text-sm"
          onClick={() => navigateDesk('/reports', 'desk')}
        >
          日報へ
        </Button>
      </div>

      {(showTitle || showBack) && (
        <div className="flex items-center justify-between">
          {showTitle ? <h1 className="text-2xl font-bold">{title}</h1> : <div />}
          {showBack && (
            <Button variant="outline" size="sm" onClick={() => navigateDesk('/office', 'desk')}>
              {backLabel}
            </Button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
