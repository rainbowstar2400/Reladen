// apps/web/lib/time.ts
// JST（Asia/Tokyo）での日時操作のヘルパー。
// 後工程で関数が増える想定。まずは必要最小限から始める。

/** 現在時刻を ISO 文字列（JST相当）で返す */
export function nowISOJST(): string {
  // Date は内部的にUTCを持つ。表示/区切りをJSTとして扱う想定で統一。
  const d = new Date();
  // ここではシンプルに ISO を返す（保存時は ISO 固定）
  return d.toISOString();
}

/** 指定の Date を、JST 表示用の "HH:MM" に整形 */
export function fmtTimeJST(d: Date): string {
  const f = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return f.format(d);
}

/** 指定の Date を、JST 表示用の { y,m,d,wd } に分解 */
export function fmtDatePartsJST(d: Date) {
  const f = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = f.formatToParts(d);
  const get = (t: string) => parts.find(x => x.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day'), wd: get('weekday') };
}
