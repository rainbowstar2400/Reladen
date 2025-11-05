export type Situation = 'active'|'preparing'|'sleeping';
export type ActivityTendency = 'morning'|'normal'|'night';

export function defaultSleepByTendency(t: ActivityTendency) {
  switch (t) {
    case 'morning': return { bedtime:'23:30', wakeTime:'05:30', prepMinutes:30 };
    case 'night':   return { bedtime:'02:30', wakeTime:'08:30', prepMinutes:30 };
    default:        return { bedtime:'01:00', wakeTime:'07:00', prepMinutes:30 };
  }
}

function hmToMinutes(hm: string) {
  const [h,m] = hm.split(':').map(Number);
  return (h * 60 + m) % 1440;
}

// start..end の半開区間判定（end < start は日跨ぎ）
function inRange(start: number, end: number, x: number) {
  return start <= end ? (x >= start && x < end) : (x >= start || x < end);
}

export function calcSituation(
  now: Date,
  profile: { bedtime:string; wakeTime:string; prepMinutes:number }
): Situation {
  const n = now.getHours()*60 + now.getMinutes();
  const bed = hmToMinutes(profile.bedtime);
  const wake = hmToMinutes(profile.wakeTime);
  const prepStart = (bed - profile.prepMinutes + 1440) % 1440;

  if (inRange(bed, wake, n)) return 'sleeping';
  if (inRange(prepStart, bed, n)) return 'preparing';
  return 'active';
}
