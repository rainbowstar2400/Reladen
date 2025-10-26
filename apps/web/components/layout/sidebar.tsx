'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Home, Building2, ClipboardList, Cog } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/home', label: 'ホーム', icon: Home },
  { href: '/office', label: '管理室', icon: Building2 },
  { href: '/reports', label: '日報', icon: ClipboardList },
  { href: '/settings', label: '設定', icon: Cog },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r bg-muted/40 p-4 md:block">
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname?.startsWith(item.href);
          return (
            <motion.div key={item.href} whileHover={{ scale: 1.01 }}>
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
          );
        })}
      </nav>
    </aside>
  );
}
