'use client';

import { SafeLink } from '@/components/layout/SafeLink';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Home, Building2, ClipboardList, Dot } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/home', label: 'ホーム', icon: Home },
  { href: '/office', label: '管理室', icon: Building2 },
  { href: '/reports', label: '日報', icon: ClipboardList },
];

const OFFICE_SUB = [
  { href: '/office/residents', label: '住人一覧' },
  { href: '/office/new', label: '新規住人登録' },
  { href: '/office/presets', label: 'プリセット管理' },
  { href: '/settings', label: '設定' },
  { href: '/playguide', label: '遊び方' },
  { href: '/specs', label: '仕様について' },
];

export function Sidebar() {
  const pathname = usePathname();
  const startsWith = (href: string) => pathname?.startsWith(href);
  const isOfficeRoute = Boolean(
    pathname && ['/office', '/settings', '/playguide', '/specs'].some((p) => pathname.startsWith(p)),
  );

  return (
    <aside className="hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r bg-muted/40 p-4 md:block md:sticky md:top-16">
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/office' ? isOfficeRoute : startsWith(item.href);
          return (
            <div key={item.href}>
              <motion.div whileHover={{ scale: 1.01 }}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-2"
                  asChild
                >
                  <SafeLink href={item.href}>
                    <Icon className="h-4 w-4" />
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
                        className="h-8 w-full justify-start gap-2 text-sm"
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
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
