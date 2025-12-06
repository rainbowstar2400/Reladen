import type { Resident, WorldStateRecord, WeatherKind } from '@/types';
import { callGptForWeatherComment } from '@/lib/gpt/call-gpt-for-weather-comment';

export async function generateWeatherComment(params: {
  world: WorldStateRecord;
  resident: Resident;
  weatherKind: WeatherKind;
  now: Date;
}): Promise<string | null> {
  return callGptForWeatherComment(params);
}
