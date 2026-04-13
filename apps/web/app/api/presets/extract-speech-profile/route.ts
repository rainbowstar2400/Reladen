import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractSpeechProfile } from '@/lib/gpt/extract-speech-profile';
import { getUserOrThrow } from '@/lib/supabase/get-user';

const requestSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  example: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await getUserOrThrow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'No authenticated user found' || message.startsWith('Failed to get user:')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    console.error('[extract-speech-profile][auth]', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

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
