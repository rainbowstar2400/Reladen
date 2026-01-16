'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './DemoWindow.module.css';

type Weather = '晴れ' | 'くもり' | '雨';
type BgTone = 'light' | 'dark';

type Resident = {
  id: string;
  status: 'online' | 'idle' | 'sleep';
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}/${m}/${day}`;
}

function formatTime(d: Date) {
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${hh}:${mm}:${ss}`;
}

function pickToneByHour(hour: number): BgTone {
  // デモ用：昼は明るめ、夜は暗め
  if (hour >= 6 && hour < 18) return 'light';
  return 'dark';
}

function pickSkyByHourAndWeather(hour: number, weather: Weather) {
  // 背景の見え方をデモ的に変える（画像があれば差し替え可能）
  const timeBand =
    hour >= 5 && hour < 9 ? 'morning' :
    hour >= 9 && hour < 16 ? 'day' :
    hour >= 16 && hour < 19 ? 'evening' : 'night';

  return { timeBand, weather };
}

export default function DemoPage() {
  const [now, setNow] = useState<Date>(() => new Date());
  const [weather, setWeather] = useState<Weather>('晴れ');

  // 住人（仮）
  const [residents] = useState<Resident[]>([
    { id: 'A', status: 'online' },
    { id: 'B', status: 'online' },
    { id: 'C', status: 'online' },
    { id: 'D', status: 'idle' },
    { id: 'E', status: 'sleep' },
    { id: 'F', status: 'online' },
    { id: 'G', status: 'idle' },
  ]);

  const tone = useMemo(() => pickToneByHour(now.getHours()), [now]);
  const sky = useMemo(() => pickSkyByHourAndWeather(now.getHours(), weather), [now, weather]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 250);
    return () => window.clearInterval(t);
  }, []);

  return (
    <main className={`${styles.stage} ${tone === 'dark' ? styles.toneDark : styles.toneLight}`}>
      {/* 背景（空＋窓枠） */}
      <div className={`${styles.sky} ${styles[`sky_${sky.timeBand}`]} ${styles[`wx_${sky.weather}`]}`} />
      <div className={styles.windowMullions} aria-hidden />

      {/* 窓ガラス上のUIレイヤー */}
      <section className={styles.overlay}>
        {/* 上部の細い帯 */}
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>天気：{weather}</div>
          <div className={styles.topBarCenter}>今は静かなようです。</div>

          {/* デモ用の操作（表示確認用） */}
          <div className={styles.topBarRight}>
            <label className={styles.selectLabel}>
              天気
              <select
                className={styles.select}
                value={weather}
                onChange={(e) => setWeather(e.target.value as Weather)}
              >
                <option value="晴れ">晴れ</option>
                <option value="くもり">くもり</option>
                <option value="雨">雨</option>
              </select>
            </label>
          </div>
        </div>

        {/* 左：通知 / 出来事 */}
        <div className={`${styles.panel} ${styles.leftPanel}`}>
          <div className={styles.panelHeader}>
            <span className={styles.mailIcon} aria-hidden>✉</span>
            <span>太郎から相談が届いています。</span>
          </div>

          <div className={styles.cards}>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.dialogLine}>
                  <span className={styles.speaker}>A</span>
                  <span className={styles.quote}>「今日はいい天気だね。」</span>
                </div>
                <div className={styles.dialogLine}>
                  <span className={styles.speaker}>B</span>
                  <span className={styles.quote}>「うん、散歩日和。」</span>
                </div>
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.cardTime}>14:00</span>
                <button className={styles.linkButton}>見てみる {'>'}</button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.dialogLine}>
                  <span className={styles.speaker}>C</span>
                  <span className={styles.quote}>「昨日の本、面白かった。」</span>
                </div>
                <div className={styles.dialogLine}>
                  <span className={styles.speaker}>D</span>
                  <span className={styles.quote}>「へぇ、そうなんだ」</span>
                </div>
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.cardTime}>13:30</span>
                <button className={styles.linkButton}>見てみる {'>'}</button>
              </div>
            </div>
          </div>
        </div>

        {/* 右：みんなの様子 */}
        <div className={`${styles.panel} ${styles.rightPanel}`}>
          <div className={styles.rightHeaderRow}>
            <div className={styles.rightTitle}>みんなの様子</div>
            <div className={styles.rightControls}>
              <select className={styles.select}>
                <option>並べ替え</option>
                <option>名前順</option>
                <option>状態順</option>
              </select>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon} aria-hidden>🔎</span>
                <input className={styles.searchInput} placeholder="検索" />
              </div>
            </div>
          </div>

          <div className={styles.residentList}>
            {residents.map((r) => (
              <div className={styles.residentRow} key={r.id}>
                <span className={`${styles.dot} ${styles[`dot_${r.status}`]}`} aria-hidden />
                <span className={styles.residentName}>{r.id}</span>
                <button className={styles.peekButton}>覗く</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 机（手元レイヤー） */}
      <footer className={styles.table}>
        <div className={styles.navLeft}>
          <span className={styles.navArrow} aria-hidden>←</span>
          <span>日報へ</span>
        </div>

        <div className={styles.clock}>
          <div className={styles.clockDate}>{formatDate(now)}</div>
          <div className={styles.clockTime}>{formatTime(now)}</div>
        </div>

        <div className={styles.navRight}>
          <span>管理室へ</span>
          <span className={styles.navArrow} aria-hidden>→</span>
        </div>
      </footer>
    </main>
  );
}
