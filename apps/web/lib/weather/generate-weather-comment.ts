import type { Resident, WeatherKind } from '@/types';
import { callGptForWeatherComment } from '@/lib/gpt/call-gpt-for-weather-comment';

export async function generateWeatherComment(params: {
  resident: Resident;
  weatherKind: WeatherKind;
  now: Date;
}): Promise<string | null> {
  return callGptForWeatherComment(params);
}
