import { NextResponse } from 'next/server';
import { runDailyDecay } from '@/lib/batch/daily-decay';
import { KvUnauthenticatedError } from '@/lib/db/kv-server';

export async function POST() {
  try {
    const result = await runDailyDecay();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KvUnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    console.error('[daily-decay] batch failed', error);
    return NextResponse.json(
      { error: 'internal', message: (error as Error)?.message },
      { status: 500 },
    );
  }
}
