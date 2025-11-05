// apps/web/lib/schedule.ts
export type Situation = 'active'|'preparing'|'sleeping';
export type ActivityTendency = 'morning'|'normal'|'night';

export function defaultSleepByTendency(t: ActivityTendency) {
  switch (t) {
    case 'morning': return { bedtime:'22:30', wakeTime:'06:30', prepMinutes:30 };
    case 'night':   return { bedtime:'02:30', wakeTime:'10:30', prepMinutes:45 };
    default:        return { bedtime:'00:00', wakeTime:'08:00', prepMinutes:30 };
  }
}

function hmToMinutes(hm: string) {
  const [h,m] = hm.split(':').map(Number);
  return (h * 60 + m) % 1440;
}

// 半開区間。end < start なら日跨ぎ
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
