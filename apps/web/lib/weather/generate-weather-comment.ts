import type { Resident, WeatherKind } from '@/types';
import { callGptForWeatherComment } from '@/lib/gpt/call-gpt-for-weather-comment';

const WEATHER_ONLY_COMMENT_RE =
  /^(今日|いま|今|現在|外|天気)?(?:は|も)?\s*(晴れ|くもり|曇り|雨|雷|雷雨|嵐|暴風雨|sunny|cloudy|rain|storm)\s*(だ|です|かな|ですね|だね|かも|っぽい|みたい)?[。．!！?？…\s]*$/iu;

const MIN_COMMENT_CHARS = 8;

const WEATHER_FALLBACKS: Record<WeatherKind, string[]> = {
  sunny: [
    '気持ちのいい天気だね。少し散歩したくなるな。',
    '日差しがやわらかくて、なんだか元気が出るな。',
  ],
  cloudy: [
    '今日は空がどんよりしてるね。ゆっくり過ごしたくなるな。',
    'くもり空だと落ち着くな。温かい飲み物でもいれようかな。',
  ],
  rain: [
    '雨の音って落ち着くね。今日は部屋でのんびりしようかな。',
    'しとしと降ってるね。傘を忘れないようにしないと。',
  ],
  storm: [
    '雷がすごいね。今日は無理せず室内で過ごそう。',
    '外が荒れてるなあ。窓際から離れて静かにしていよう。',
  ],
};

function normalizeComment(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2);

  return lines.join('\n').trim();
}

function isTooShortOrWeatherOnly(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (compact.length < MIN_COMMENT_CHARS) return true;
  return WEATHER_ONLY_COMMENT_RE.test(compact);
}

function fallbackWeatherComment(weatherKind: WeatherKind, now: Date): string {
  const candidates = WEATHER_FALLBACKS[weatherKind] ?? WEATHER_FALLBACKS.sunny;
  const seed = now.getUTCFullYear() + now.getUTCMonth() + now.getUTCDate() + now.getUTCHours();
  return candidates[Math.abs(seed) % candidates.length] ?? WEATHER_FALLBACKS.sunny[0];
}

export async function generateWeatherComment(params: {
  resident: Resident;
  weatherKind: WeatherKind;
  now: Date;
}): Promise<string | null> {
  const generated = await callGptForWeatherComment(params);
  if (typeof generated === 'string') {
    const normalized = normalizeComment(generated);
    if (normalized && !isTooShortOrWeatherOnly(normalized)) {
      return normalized;
    }
  }

  return fallbackWeatherComment(params.weatherKind, params.now);
}
