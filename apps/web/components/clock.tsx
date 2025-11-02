'use client';

import { useEffect, useState } from 'react';

export function Clock() {
  // 1. サーバー/クライアントの初回描画時は null (または '--:--:--' など) にする
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // 2. クライアントでのみ実行される useEffect の中で、実際の値をセットする
    setTime(new Date());
    
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  // 3. null の場合は何も表示しない（またはプレースホルダーを表示）
  if (time === null) {
    return null; // これでサーバーとクライアントの初回描画が一致する
  }

  return <div>{time.toLocaleTimeString()}</div>;
}
