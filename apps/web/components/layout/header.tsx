'use client';

import Link from 'next/link';
import { ModeToggle } from '@/components/mode-toggle';
import { SyncIndicator } from '@/components/sync-indicator';
import { motion } from 'framer-motion';
import { Clock } from '@/components/clock';
import { Home } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--board-border)] bg-[color:var(--app-bg)] backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--paper-border)] bg-[color:var(--paper-bg)] text-[color:var(--ink)] shadow-[var(--shadow-paper)] transition hover:bg-[color:var(--surface-bg)]"
              aria-label="ホームへ"
            >
              <Home className="h-4 w-4" />
            </Link>
            <Link href="/home" className="font-semibold text-[color:var(--ink)]">
              Reladen
            </Link>
          </div>
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
