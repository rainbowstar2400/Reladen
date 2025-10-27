'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Home, Building2, ClipboardList, Cog, Dot } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/home', label: 'ホーム', icon: Home },
  { href: '/office', label: '管理室', icon: Building2 },
  { href: '/reports', label: '日報', icon: ClipboardList },
  { href: '/settings', label: '設定', icon: Cog },
];

const OFFICE_SUB = [
  { href: '/residents', label: '住人一覧' },
  { href: '/residents/new', label: '新規住人登録' },
  { href: '/office/presets', label: 'プリセット管理' },
];

const SETTINGS_SUB = [
  { href: '/settings#data', label: 'データ管理' },
  { href: '/settings#a11y', label: 'アクセシビリティ' },
  { href: '/settings#about', label: 'ゲームについて' },
];

export function Sidebar() {
  const pathname = usePathname();
  const startsWith = (href: string) => pathname?.startsWith(href);

  return (
    <aside className="hidden w-64 border-r bg-muted/40 p-4 md:block">
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = startsWith(item.href);
          return (
            <div key={item.href}>
              <motion.div whileHover={{ scale: 1.01 }}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn('w-full justify-start gap-2')}
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
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
                        <Link href={sub.href}>
                          <Dot className="h-4 w-4" />
                          {sub.label}
                        </Link>
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
                        <Link href={sub.href}>• {sub.label}</Link>
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
