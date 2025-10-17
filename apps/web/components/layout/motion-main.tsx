'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function MotionMain({ children }: { children: ReactNode }) {
  return (
    <motion.main
      className="flex-1 overflow-y-auto bg-background"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6">{children}</div>
    </motion.main>
  );
}
