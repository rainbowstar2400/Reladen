export type Situation = 'active' | 'preparing' | 'sleeping';

// SleepProfile の型定義 (DBスキーマと合わせる)
export type BaseSleepProfile = {
  baseBedtime: string;   // 'HH:mm' (基準就寝時刻)
  baseWakeTime: string;  // 'HH:mm' (基準起床時刻)
  prepMinutes: number;   // 準備時間 (分)
};

export type TodaySchedule = {
  date: string;       // 'YYYY-MM-DD'
  bedtime: string;    // 'HH:mm' (今日の就寝時刻)
  wakeTime: string;   // 'HH:mm' (今日の起床時刻)
};

// DBの `residents.sleepProfile` にはこの型が保存されます
export type SleepProfile = BaseSleepProfile & {
  todaySchedule?: TodaySchedule;
};

function hmToMinutes(hm: string): number {
  // time が文字列であり、かつ ':' を含む場合のみ処理を続行
  if (typeof hm === 'string' && hm.includes(':')) {
    const [h, m] = hm.split(':').map(Number);
    // h や m が NaN でないことを確認
    if (!isNaN(h) && !isNaN(m)) {
      return (h * 60 + m) % 1440;
    }
  }
  // それ以外 (undefined, null, ':' がない等) は安全な値 (0時 = 0) を返す
  // フォームとは違い、こちらは0時を返すのが安全
  return 0;
}

// start..end の半開区間判定（end < start は日跨ぎ）
function inRange(start: number, end: number, x: number) {
  return start <= end ? (x >= start && x < end) : (x >= start || x < end);
}

// --- スケジュール抽選ロジック ---

/**
 * 分単位の時刻を 'HH:mm' 形式に変換する
 */
function minutesToHm(totalMinutes: number): string {
  // 1440分 = 1日
  const m = (totalMinutes + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * 基準時刻 (HH:mm) から ±rangeMinutes の範囲でランダムな時刻 (HH:mm) を生成
 */
function randomizeTime(baseHm: string, rangeMinutes: number): string {
  const baseMinutes = hmToMinutes(baseHm);
  // -rangeMinutes から +rangeMinutes までのランダムなオフセット
  // (例: rangeMinutes=60 の場合、-60 から +60 まで)
  const offset = Math.floor(Math.random() * (rangeMinutes * 2 + 1)) - rangeMinutes;
  const randomizedMinutes = (baseMinutes + offset + 1440) % 1440;
  return minutesToHm(randomizedMinutes);
}

/**
 * JST基準の 'YYYY-MM-DD' 文字列を取得
 * (サーバーとクライアントのタイムゾーン差異を吸収するため JST で計算)
 */
const SCHEDULE_DECISION_HOUR_JST = 12; // スケジュールを確定させる基準時刻 (JST)
function getTodayJST(): string {
  const jstNow = Date.now() + (9 * 60 * 60 * 1000);
  const adjusted = jstNow - (SCHEDULE_DECISION_HOUR_JST * 60 * 60 * 1000);
  return new Date(adjusted).toISOString().split('T')[0];
}

/**
 * 今日の就寝・起床時刻を抽選する関数
 */
export function generateTodaySchedule(
  profile: BaseSleepProfile,
  randomRangeMinutes: number = 60 // ご要望の ±1時間 (60分)
): TodaySchedule {

  const today = getTodayJST();
  const newBedtime = randomizeTime(profile.baseBedtime, randomRangeMinutes);
  const newWakeTime = randomizeTime(profile.baseWakeTime, randomRangeMinutes);

  return {
    date: today,
    bedtime: newBedtime,
    wakeTime: newWakeTime,
  };
}

/**
 * SleepProfile を受け取り、必要なら今日のスケジュールを生成・更新して返す
 * (データフック `useResidents` で呼び出す)
 * @returns { profile: SleepProfile, needsUpdate: boolean }
 * needsUpdate: true の場合、呼び出し元はDB (ローカル) を更新する必要がある
 */
export function getOrGenerateTodaySchedule(
  profile: SleepProfile,
  forceRegenerate: boolean = false
): { profile: SleepProfile, needsUpdate: boolean } {

  const today = getTodayJST();

  // 基準時刻が未設定の場合は何もしない
  if (!profile.baseBedtime || !profile.baseWakeTime) {
    return { profile, needsUpdate: false };
  }

  const needsGeneration = !profile.todaySchedule || profile.todaySchedule.date !== today;

  if (needsGeneration || forceRegenerate) {
    // 基準時刻 (BaseSleepProfile) のみを使ってスケジュールを生成
    const baseProfile: BaseSleepProfile = {
      baseBedtime: profile.baseBedtime,
      baseWakeTime: profile.baseWakeTime,
      prepMinutes: profile.prepMinutes,
    };
    const newSchedule = generateTodaySchedule(baseProfile);

    const updatedProfile: SleepProfile = {
      ...profile,
      todaySchedule: newSchedule,
    };
    // DB更新が必要なことを通知
    return { profile: updatedProfile, needsUpdate: true };
  }

  // スケジュールは最新なので、DB更新は不要
  return { profile, needsUpdate: false };
}


// --- 状態計算ロジック ---

/**
 * * 渡される profile には、抽選済みの `todaySchedule` が含まれていることを期待する。
 */
export function calcSituation(
  now: Date,
  profile: SleepProfile // { ...base, todaySchedule: { ... } }
): Situation {

  // 今日のスケジュールが未生成（または古い）場合
  // (getOrGenerateTodaySchedule を先に呼んでいれば基本ここには入らない)
  const today = getTodayJST();
  if (!profile.todaySchedule || profile.todaySchedule.date !== today) {
    // console.warn('calcSituation: todaySchedule is missing or outdated.');
    return 'active'; // 安全なデフォルト値
  }

  // 抽選された「今日」のスケジュールと、固定の「準備時間」を使用
  const { bedtime, wakeTime } = profile.todaySchedule;
  const prepMinutes = profile.prepMinutes;

  const n = now.getHours() * 60 + now.getMinutes();
  const bed = hmToMinutes(bedtime);
  const wake = hmToMinutes(wakeTime);

  // 就寝準備開始時刻（抽選された就寝時刻の prepMinutes 前）
  // (ご要望: 就寝時刻の30分前になったら「就寝準備中」)
  const prepStart = (bed - prepMinutes + 1440) % 1440;

  if (inRange(bed, wake, n)) return 'sleeping';
  if (inRange(prepStart, bed, n)) return 'preparing';
  return 'active';
}

// (古い schedule.ts から移管)
export type ActivityTendency = 'morning' | 'normal' | 'night';

/**
 * 傾向からデフォルトの「基準」睡眠プロファイル(BaseSleepProfile)を生成する
 */
export function defaultSleepByTendency(t: ActivityTendency): BaseSleepProfile {
  switch (t) {
    case 'morning':
      return { baseBedtime: '22:30', baseWakeTime: '06:30', prepMinutes: 30 };
    case 'night':
      return { baseBedtime: '02:30', baseWakeTime: '10:30', prepMinutes: 45 };
    default:
      return { baseBedtime: '00:00', baseWakeTime: '08:00', prepMinutes: 30 };
  }
}
