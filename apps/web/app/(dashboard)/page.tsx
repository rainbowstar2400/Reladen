import { redirect } from 'next/navigation'
import { useEffect } from 'react';
import { subscribeRealtime } from '@/lib/realtime/events-subscribe';

useEffect(() => {
  const unsubscribe = subscribeRealtime();
  return () => {
    // 同期クリーンアップ（Promiseを返さない）
    unsubscribe();
  };
}, []);
