'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { UserRound, HeartHandshake, Sparkle, NotebookPen } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/residents', label: '住人', icon: UserRound },
  { href: '/relations', label: '関係', icon: HeartHandshake },
  { href: '/feelings', label: '感情', icon: Sparkle },
  { href: '/events', label: 'イベント', icon: NotebookPen },
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
