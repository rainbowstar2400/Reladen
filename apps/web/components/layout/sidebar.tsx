'use client';

import { SafeLink } from '@/components/layout/SafeLink';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Home, Building2, ClipboardList, Cog, Dot, HelpCircle, Info } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/home', label: 'ホーム', icon: Home },
  { href: '/office', label: '管理室', icon: Building2 },
  { href: '/reports', label: '日報', icon: ClipboardList },
  { href: '/settings', label: '設定', icon: Cog },
  { href: '/how-to-play', label: '遊び方', icon: HelpCircle },
  { href: '/specs', label: '仕様説明', icon: Info },
];

const OFFICE_SUB = [
  { href: '/office/residents', label: '住人一覧' },
  { href: '/office/new', label: '新規住人登録' },
  { href: '/office/presets', label: 'プリセット管理' },
];

const SETTINGS_SUB = [
  { href: '/settings#data', label: 'データ管理' },
  { href: '/settings#a11y', label: 'アクセシビリティ' },
  { href: '/settings#about', label: 'ゲームについて' },
];

const HOW_TO_PLAY_SUB = [
  { href: '/how-to-play#1', label: 'Reladenとは？' },
  { href: '/how-to-play#2', label: '画面構成' },
  { href: '/how-to-play#3', label: '住人について' },
  { href: '/how-to-play#4', label: 'ゲームの進み方' },
  { href: '/how-to-play#5', label: 'あなたができること' },
  { href: '/how-to-play#6', label: 'データの保存と表示' },
  { href: '/how-to-play#7', label: 'よくある質問' },
];

const SPECS_SUB = [
  { href: '/specs#1', label: 'システム概要' },
  { href: '/specs#2', label: 'データフロー' },
  { href: '/specs#3', label: 'プライバシーポリシー' },
];

export function Sidebar() {
  const pathname = usePathname();
  const startsWith = (href: string) => pathname?.startsWith(href);

  return (
    <aside className="hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r bg-muted/40 p-4 md:block md:sticky md:top-16">
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = startsWith(item.href);
          const lessProminent = item.href === '/specs'; // 仕様説明を目立たなくするフラグ
          return (
            <div key={item.href}>
              <motion.div whileHover={{ scale: 1.01 }}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  // lessProminentの場合にスタイルを調整
                  className={cn(
                    'w-full justify-start gap-2',
                    lessProminent ? 'h-8 text-sm opacity-80' : '' // 小さく、控えめなスタイル
                  )}
                  asChild
                >
                  <SafeLink href={item.href}>
                    {/* lessProminentの場合はアイコンを非表示（または別の小さいアイコン）*/}
                    <Icon className={cn("h-4 w-4", lessProminent && 'hidden')} />
                    {item.label}
                  </SafeLink>
                </Button>
              </motion.div>

              {item.href === '/office' && active && (
                <div className="mt-1 space-y-1 pl-8">
                  {OFFICE_SUB.map((sub) => {
                    const subActive = startsWith(sub.href);
                    return (
                      <Button
                        key={sub.href}
                        variant={subActive ? 'secondary' : 'ghost'}
                        className={cn('h-8 w-full justify-start gap-2 text-sm')}
                        asChild
                      >
                        <SafeLink href={sub.href}>
                          <Dot className="h-4 w-4" />
                          {sub.label}
                        </SafeLink>
                      </Button>
                    );
                  })}
                </div>
              )}
              {item.href === '/settings' && active && (
                <div className="mt-1 space-y-1 pl-8">
                  {SETTINGS_SUB.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Button
                        key={sub.href}
                        variant={subActive ? 'secondary' : 'ghost'}
                        className="h-8 w-full justify-start gap-2 text-sm"
                        asChild
                      >
                        <SafeLink href={sub.href}>• {sub.label}</SafeLink>
                      </Button>
                    );
                  })}
                </div>
              )}
              {item.href === '/how-to-play' && active && (
                <div className="mt-1 space-y-1 pl-8">
                  {HOW_TO_PLAY_SUB.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Button
                        key={sub.href}
                        variant={subActive ? 'secondary' : 'ghost'}
                        className="h-8 w-full justify-start gap-2 text-sm"
                        asChild
                      >
                        <SafeLink href={sub.href}>• {sub.label}</SafeLink>
                      </Button>
                    );
                  })}
                </div>
              )}
              {item.href === '/specs' && active && (
                <div className="mt-1 space-y-1 pl-8">
                  {SPECS_SUB.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Button
                        key={sub.href}
                        variant={subActive ? 'secondary' : 'ghost'}
                        className="h-8 w-full justify-start gap-2 text-sm"
                        asChild
                      >
                        <SafeLink href={sub.href}>• {sub.label}</SafeLink>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
