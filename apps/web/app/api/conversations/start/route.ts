import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runConversation } from '@/lib/conversation/run-conversation';
import type {
  ConversationResidentProfile,
} from '@repo/shared/gpt/prompts/conversation-prompt';
import type { BeliefRecord } from '@repo/shared/types/conversation';
import { KvUnauthenticatedError } from '@/lib/db/kv-server';

const residentProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional().nullable(),
  mbti: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  age: z.number().int().optional().nullable(),
  occupation: z.string().optional().nullable(),
  speechPreset: z.string().optional().nullable(),
  speechExample: z.string().optional().nullable(),
  firstPerson: z.string().optional().nullable(),
  traits: z.unknown().optional().nullable(),
  interests: z.unknown().optional().nullable(),
  summary: z.string().optional().nullable(),
});

const beliefRecordSchema = z.object({
  id: z.string().uuid(),
  residentId: z.string().uuid(),
  worldFacts: z
    .array(
      z.object({
        eventId: z.string().uuid(),
        learnedAt: z.string().datetime(),
      }),
    )
    .optional(),
  personKnowledge: z
    .record(
      z.object({
        keys: z.array(z.string()),
        learnedAt: z.string().datetime(),
      }),
    )
    .optional(),
  updated_at: z.string().datetime().optional(),
  deleted: z.boolean().optional(),
});

const contextSchema = z
  .object({
    residents: z.record(z.string().uuid(), residentProfileSchema).optional(),
    beliefs: z.record(z.string().uuid(), beliefRecordSchema).optional(),
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
  beliefs?: Record<string, BeliefRecord>;
} {
  if (!raw) return {};
  const normalized: {
    residents?: Record<string, ConversationResidentProfile>;
    beliefs?: Record<string, BeliefRecord>;
  } = {};

  if (raw.residents) {
    normalized.residents = Object.fromEntries(
      Object.entries(raw.residents).map(([id, profile]) => [id, profile]),
    );
  }

  if (raw.beliefs) {
    normalized.beliefs = Object.fromEntries(
      Object.entries(raw.beliefs).map(([residentId, belief]) => [
        residentId,
        {
          id: belief.id,
          residentId: belief.residentId,
          worldFacts: belief.worldFacts ?? [],
          personKnowledge: belief.personKnowledge ?? {},
          updated_at: belief.updated_at ?? new Date().toISOString(),
          deleted: belief.deleted ?? false,
        },
      ]),
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
      beliefsOverride: overrides.beliefs,
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
