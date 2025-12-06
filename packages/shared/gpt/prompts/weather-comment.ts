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

  const system = `
あなたは日本語で短い一言コメントを返すアシスタントです。
出力は1〜2行、装飾や絵文字を避けてください。
`.trim();

  const user = `
住人: ${resident.name ?? '名前未設定'}
一人称: ${firstPerson ?? '未設定'}
話し方プリセット: ${speechPreset ?? '未設定'}
現在の時間帯: ${timeLabel}（${hour}時台）
天気: ${weatherKind}

天気に対する一言コメントを日本語で返してください。
`.trim();

  return { system, user };
}
