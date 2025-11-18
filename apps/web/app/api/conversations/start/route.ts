import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runConversation } from '@/lib/conversation/run-conversation';

const startConversationSchema = z.object({
  threadId: z.string().uuid().optional(),
  participants: z.tuple([z.string().min(1), z.string().min(1)]),
  topicHint: z.string().min(1).optional(),
  lastSummary: z.string().min(1).optional(),
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

  const { threadId, participants, topicHint, lastSummary } = parsed.data;

  try {
    const { eventId, threadId: ensuredThreadId } = await runConversation({
      threadId,
      participants,
      topicHint,
      lastSummary,
    });

    return NextResponse.json({ eventId, threadId: ensuredThreadId });
  } catch (error) {
    console.error('[Conversations API] Failed to run conversation', error);
    return NextResponse.json({ error: 'conversation_failed' }, { status: 500 });
  }
}
