import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractSpeechProfile } from '@/lib/gpt/extract-speech-profile';

const requestSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  example: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await extractSpeechProfile(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[extract-speech-profile]', e);
    return NextResponse.json({ error: 'extraction_failed' }, { status: 500 });
  }
}
