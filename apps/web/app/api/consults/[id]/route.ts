// apps/web/app/api/consults/[id]/route.ts
import { NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase/server';
import { getUserOrThrow } from '@/lib/supabase/get-user';

/**
 * 既存UIが「ダミーと同じ形」で受け取れるよう、payload を正規化。
 * ここは“あなたのダミー構造”に合わせて調整してください（下記は代表例）。
 */
function normalizeConsultRow(row: any) {
  const p = row?.payload ?? {};

  // --- ダミー側のキーに合わせる（例） ---
  // ダミーが { id, title, content, choices?, updated_at } を想定しているケース
  return {
    id: row.id,
    kind: row.kind ?? 'consult',
    payload: p,
    title: p.title ?? p.subject ?? '相談',
    content: p.content ?? p.body ?? '',
    choices: Array.isArray(p.choices) ? p.choices : (Array.isArray(p.options) ? p.options : []),
    // 相談詳細にタイムスタンプを見せるなら：
    updated_at: row.updated_at,
    // 将来の拡張（必要ならUIが拾えるように置いておく）
    meta: p.meta ?? {},
  };
}

function normalizeConsultAnswerRow(row: any) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    selectedChoiceId: row.selected_choice_id != null ? String(row.selected_choice_id) : null,
    decidedAt: row.decided_at != null ? String(row.decided_at) : null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = ctx?.params?.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const user = await getUserOrThrow();
    const sb = sbServer();

    // consult イベントを 1 件取得
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('kind', 'consult')
      .eq('owner_id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (!data) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    // consult_answers は存在すれば併せて返却（表示はサーバー回答を優先）
    let answer: ReturnType<typeof normalizeConsultAnswerRow> = null;
    try {
      const { data: answerData, error: answerError } = await sb
        .from('consult_answers')
        .select('*')
        .eq('id', id)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (answerError) {
        console.warn('[Consult API] Failed to load consult_answers row', answerError.message);
      } else {
        answer = normalizeConsultAnswerRow(answerData);
      }
    } catch (error) {
      console.warn('[Consult API] Failed to read consult answer:', (error as any)?.message ?? String(error));
    }

    // ダミー互換の形に正規化して返す
    const consult = normalizeConsultRow(data);
    return NextResponse.json({ consult, answer }, { status: 200 });
  } catch (e: any) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'No authenticated user found' || message.startsWith('Failed to get user:')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message ?? 'unexpected error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}
