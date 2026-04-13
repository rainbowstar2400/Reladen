// apps/web/app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { sbServer } from '@/lib/supabase/server';

type Payload = {
  event: AuthChangeEvent;
  session: Session | null;
};

const SYNC_EVENTS: AuthChangeEvent[] = ['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'];

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (!allowedOrigin) {
    console.error('[auth/callback] NEXT_PUBLIC_APP_URL is not configured');
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  if (!origin || origin !== allowedOrigin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: Payload | null = null;
  try {
    payload = (await request.json()) as Payload;
  } catch (error) {
    return NextResponse.json({ ok: false, reason: 'invalid body' }, { status: 400 });
  }

  if (!payload || !SYNC_EVENTS.includes(payload.event)) {
    return NextResponse.json({ ok: false, reason: 'unsupported event' }, { status: 400 });
  }

  const supabase = sbServer();

  if ((payload.event === 'SIGNED_IN' || payload.event === 'TOKEN_REFRESHED') && payload.session) {
    await supabase.auth.setSession(payload.session);
  } else if (payload.event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true });
}
