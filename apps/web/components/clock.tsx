'use client';

import { useEffect, useState } from 'react';

export function Clock() {
  // マウント前は null にしておき、SSR と CSR の初期描画を一致させる
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // 初回マウント時に現在時刻を設定
    setNow(new Date());
    // 1 秒ごとに時刻を更新
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // now が null の間は何も描画しない（またはプレースホルダーを返しても良い）
  if (now === null) return null;

  // 日付・時刻を 2 桁に揃えるためのユーティリティ
  const z = (n: number) => String(n).padStart(2, '0');
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];

  return (
    <span className="tabular-nums">
      {now.getFullYear()}/{z(now.getMonth() + 1)}/{z(now.getDate())}
      &nbsp;&nbsp;{wd}&nbsp;&nbsp;
      {z(now.getHours())}:{z(now.getMinutes())}:{z(now.getSeconds())}
    </span>
  );
}
