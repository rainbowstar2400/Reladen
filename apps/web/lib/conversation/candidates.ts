import type { Resident } from '@/types';
import { defaultSleepByTendency, calcSituation } from '../schedule';

export function selectConversationCandidates(now: Date, residents: Resident[]) {
  return residents.filter(r => {
    const base =
      r.sleepProfile
        ?? (r.activityTendency
              ? defaultSleepByTendency(r.activityTendency as 'morning'|'normal'|'night')
              : defaultSleepByTendency('normal'));
    const sit = calcSituation(now, base);
    return sit !== 'sleeping';
  });
}
