'use client';

import { useEffect, useState } from 'react';

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(t);
  }, []);

  const z = (n: number) => String(n).padStart(2, '0');
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];

  return (
    <span className="tabular-nums">
      {now.getFullYear()}/{z(now.getMonth() + 1)}/{z(now.getDate())}
      &nbsp;&nbsp;{wd}&nbsp;&nbsp;{z(now.getHours())}:{z(now.getMinutes())}:{z(now.getSeconds())}
    </span>
  );
}
