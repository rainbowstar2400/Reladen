import type { WeatherKind, Resident } from '@repo/shared/types';

export type WeatherCommentInput = {
  resident: Resident;
  weatherKind: WeatherKind;
  now: Date;
};

export function buildWeatherCommentPrompt(input: WeatherCommentInput): { system: string; user: string } {
  const { resident, weatherKind, now } = input;
  const hour = now.getHours();
  const timeLabel =
    hour < 5 ? '深夜' :
    hour < 10 ? '朝' :
    hour < 15 ? '昼' :
    hour < 19 ? '夕方' :
    '夜';

  const speechPreset = (resident as any)?.speechPreset;
  const firstPerson = (resident as any)?.firstPerson;
  const weatherLabel =
    weatherKind === 'sunny' ? '晴れ' :
    weatherKind === 'cloudy' ? 'くもり' :
    weatherKind === 'rain' ? '雨' :
    '雷雨';

  const system = `
あなたは住人の独り言を日本語で短く返すアシスタントです。
天気に関連した気分や行動を必ず1つ含めてください。
「晴れ」「雨です」「雷」など、天気名だけの返答は禁止です。
出力は1〜2行、装飾や絵文字を避けてください。
`.trim();

  const user = `
住人: ${resident.name ?? '名前未設定'}
一人称: ${firstPerson ?? '未設定'}
話し方プリセット: ${speechPreset ?? '未設定'}
現在の時間帯: ${timeLabel}（${hour}時台）
天気: ${weatherLabel}（${weatherKind}）

天気に対する一言コメントを日本語で返してください。
`.trim();

  return { system, user };
}
