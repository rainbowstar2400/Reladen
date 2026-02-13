import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runConversation } from '@/lib/conversation/run-conversation';
import type {
  ConversationResidentProfile,
} from '@repo/shared/gpt/prompts/conversation-prompt';
import { KvUnauthenticatedError } from '@/lib/db/kv-server';

const residentProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional().nullable(),
  mbti: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  age: z.number().int().optional().nullable(),
  occupation: z.string().optional().nullable(),
  speechPreset: z.string().optional().nullable(),
  speechPresetDescription: z.string().optional().nullable(),
  speechExample: z.string().optional().nullable(),
  firstPerson: z.string().optional().nullable(),
  traits: z.unknown().optional().nullable(),
  interests: z.unknown().optional().nullable(),
  summary: z.string().optional().nullable(),
});

const contextSchema = z
  .object({
    residents: z.record(z.string().uuid(), residentProfileSchema).optional(),
  })
  .optional();

const startConversationSchema = z.object({
  threadId: z.string().uuid().optional(),
  participants: z.tuple([z.string().min(1), z.string().min(1)]),
  topicHint: z.string().min(1).optional(),
  lastSummary: z.string().min(1).optional(),
  context: contextSchema,
});

function normalizeContext(
  raw?: z.infer<typeof contextSchema>,
): {
  residents?: Record<string, ConversationResidentProfile>;
} {
  if (!raw) return {};
  const normalized: {
    residents?: Record<string, ConversationResidentProfile>;
  } = {};

  if (raw.residents) {
    normalized.residents = Object.fromEntries(
      Object.entries(raw.residents).map(([id, profile]) => [id, profile]),
    );
  }

  return normalized;
}

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

  const { threadId, participants, topicHint, lastSummary, context } = parsed.data;
  const overrides = normalizeContext(context);

  try {
    const { eventId, threadId: ensuredThreadId } = await runConversation({
      threadId,
      participants,
      topicHint,
      lastSummary,
      residentProfilesOverride: overrides.residents,
    });

    return NextResponse.json({ eventId, threadId: ensuredThreadId });
  } catch (error) {
    const err = error as any;

    console.error('[Conversations API] Failed to run conversation', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });

    // 認証エラーの場合は 401 を返す
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
