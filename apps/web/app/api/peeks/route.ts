// apps/web/app/api/peeks/route.ts
// 覗く機能 API: 住人の「今の様子」を GPT で生成

import { NextResponse } from "next/server";
import { z } from "zod";
import { listKV as listAny } from "@/lib/db/kv-server";
import { KvUnauthenticatedError } from "@/lib/db/kv-server";
import { callGptForPeek } from "@/lib/gpt/call-gpt-for-peek";

const peekRequestSchema = z.object({
  residentId: z.string().uuid(),
  timeOfDay: z.string().optional(),
  weather: z.string().optional(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = peekRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { residentId, timeOfDay, weather } = parsed.data;

  try {
    // 住人情報を取得
    const residents = (await listAny("residents")) as any[] | null;
    const resident = residents?.find((r) => r.id === residentId && !r.deleted);
    if (!resident) {
      return NextResponse.json({ error: "resident_not_found" }, { status: 404 });
    }

    // 直近のイベントを取得（会話要約用）
    const events = (await listAny("events")) as any[] | null;
    const recentConversations = (events ?? [])
      .filter(
        (e) =>
          e.kind === "conversation" &&
          !e.deleted &&
          Array.isArray(e.payload?.participants) &&
          e.payload.participants.includes(residentId),
      )
      .sort((a, b) => {
        const ta = new Date(a.updated_at ?? 0).getTime();
        const tb = new Date(b.updated_at ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, 3);

    // 会話イベントから要約を作成
    const recentEventSummaries = recentConversations.map((e) => {
      const lines = Array.isArray(e.payload?.lines) ? e.payload.lines : [];
      const first = lines[0];
      if (first?.text) {
        return `${first.speaker ?? "?"}: ${first.text.slice(0, 40)}`;
      }
      return e.payload?.topic ?? "会話があった";
    });

    // プリセットからoccupationラベルを解決
    let occupationLabel: string | null = null;
    if (resident.occupation) {
      const presets = (await listAny("presets")) as any[] | null;
      const preset = presets?.find((p) => p.id === resident.occupation && !p.deleted);
      occupationLabel = preset?.label ?? null;
    }

    const result = await callGptForPeek({
      character: {
        name: resident.name ?? "住人",
        gender: resident.gender,
        age: resident.age,
        occupation: occupationLabel,
        mbti: resident.mbti,
        traits: resident.traits ?? {},
        interests: Array.isArray(resident.interests) ? resident.interests : [],
      },
      environment: {
        timeOfDay: timeOfDay ?? "日中",
        weather: weather ?? undefined,
      },
      recentEventSummaries,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KvUnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[Peek API] Failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
