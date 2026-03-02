import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runConversationFromApi } from '@/lib/conversation/run-conversation';
import { KvUnauthenticatedError } from '@/lib/db/kv-server';

const startConversationSchema = z.object({
  threadId: z.string().uuid().optional(),
  participants: z.tuple([z.string().min(1), z.string().min(1)]),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = startConversationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { threadId, participants } = parsed.data;

  try {
    const { eventId, threadId: ensuredThreadId } = await runConversationFromApi({
      threadId,
      participants,
    });

    return NextResponse.json({ eventId, threadId: ensuredThreadId });
  } catch (error) {
    const err = error as any;

    console.error('[Conversations API] Failed to run conversation', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });

    if (error instanceof KvUnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'conversation_failed',
        name: err?.name ?? 'UnknownError',
        message: err?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
