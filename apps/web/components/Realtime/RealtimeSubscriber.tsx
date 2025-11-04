'use client';

import { useEffect } from 'react';
import { subscribeRealtime } from '@/lib/realtime/events-subscribe';

/**
 * Supabase Realtime を購読し、到着行を IndexedDB に流し込むだけの見えない部品。
 * ページどこに配置してもOK（重複配置しないように1箇所だけ設置）。
 */
export default function RealtimeSubscriber() {
  useEffect(() => {
    const off = subscribeRealtime();
    return off;
  }, []);

  return null;
}
