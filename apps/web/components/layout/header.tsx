'use client';

import Link from 'next/link';
import { ModeToggle } from '@/components/mode-toggle';
import { SyncIndicator } from '@/components/sync-indicator';
import { motion } from 'framer-motion';
import { Clock } from '@/components/clock';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/home" className="font-semibold">
            Reladen
          </Link>
        </motion.div>
        <div className="flex items-center gap-4">
          <SyncIndicator />
          <ModeToggle />
          <Clock />
        </div>
      </div>
    </header>
  );
}
