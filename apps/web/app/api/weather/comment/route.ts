export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWeatherComment } from '@/lib/weather/generate-weather-comment';
import type { Resident } from '@/types';
import type { WeatherKind } from '@repo/shared/types';

const payloadSchema = z.object({
  resident: z.any(), // 軽いバリデーション。詳細は generateWeatherComment に委譲
  weatherKind: z.string(),
  now: z.string().datetime(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const { resident, weatherKind, now } = parsed.data;
    const text = await generateWeatherComment({
      resident: resident as Resident,
      weatherKind: weatherKind as WeatherKind,
      now: new Date(now),
    });

    if (!text) return NextResponse.json({ error: 'generation_failed' }, { status: 500 });

    return NextResponse.json({ text });
  } catch (error) {
    console.error('[weather/comment] failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
