// apps/web/app/api/consults/generate/route.ts
// 相談生成 API: キャラ情報からGPTで相談テーマを生成し、event + notification を作成

import { NextResponse } from "next/server";
import { z } from "zod";
import { putKV as putAny, listKV as listAny } from "@/lib/db/kv-server";
import { KvUnauthenticatedError } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";
import { generateConsultTheme } from "@/lib/gpt/call-gpt-for-consult";
import {
  getTrustBand,
  pickCategoryAndSeed,
  buildTransitionChoices,
  TRUST_BAND_TONE,
  CONSULT_EXPIRY_HOURS,
} from "@repo/shared/logic/consult";

const generateRequestSchema = z.object({
  residentId: z.string().uuid(),
  triggerId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { residentId, triggerId } = parsed.data;

  try {
    // 住人情報を取得
    const residents = (await listAny("residents")) as any[] | null;
    const resident = residents?.find((r) => r.id === residentId && !r.deleted);
    if (!resident) {
      return NextResponse.json({ error: "resident_not_found" }, { status: 404 });
    }

    const trust: number = resident.trustToPlayer ?? resident.trust_to_player ?? 50;
    const trustBand = getTrustBand(trust);
    const traits = resident.traits ?? {};
    const now = new Date();

    // 関係遷移トリガーかどうか判定
    let isTransition = false;
    let triggerEvent: any = null;
    let participants: string[] = [residentId];

    if (triggerId) {
      const events = (await listAny("events")) as any[] | null;
      triggerEvent = events?.find(
        (e) => e.id === triggerId && e.kind === "relation_trigger" && !e.deleted,
      );
      if (triggerEvent) {
        isTransition = true;
        participants = Array.isArray(triggerEvent.payload?.participants)
          ? triggerEvent.payload.participants
          : [residentId];
      }
    }

    // テーマ生成
    let themeResult;
    let category: string;
    let seed: string;

    if (isTransition && triggerEvent) {
      // 関係遷移相談: テンプレート選択肢を使用
      const trigger = triggerEvent.payload?.trigger as "confession" | "breakup";
      const choices = buildTransitionChoices(trigger);
      category = "relation_transition";
      seed = trigger;

      // 口調プリセット解決
      let speechSummary: string | null = null;
      if (resident.speechPreset) {
        const presets = (await listAny("presets")) as any[] | null;
        const preset = presets?.find((p) => p.id === resident.speechPreset && !p.deleted);
        speechSummary = preset?.label ?? null;
      }

      // 関係遷移相談でもGPTでcontent(相談本文)を生成
      themeResult = await generateConsultTheme({
        character: {
          name: resident.name ?? "住人",
          gender: resident.gender,
          age: resident.age,
          mbti: resident.mbti,
          traits,
          speechProfileSummary: speechSummary,
        },
        trustBandTone: TRUST_BAND_TONE[trustBand],
        category: trigger === "confession" ? "告白の相談" : "別れの相談",
        seed: trigger === "confession" ? "好きな人に告白するか迷っている" : "相手と別れるか迷っている",
        recentSummaries: [],
      });

      // GPT生成のchoicesをテンプレート選択肢で上書き
      themeResult = { ...themeResult, choices };
    } else {
      // 通常相談: カテゴリ＋シード方式
      const picked = pickCategoryAndSeed(trustBand);
      category = picked.category;
      seed = picked.seed;

      // 口調プリセット解決
      let speechSummary: string | null = null;
      if (resident.speechPreset) {
        const presets = (await listAny("presets")) as any[] | null;
        const preset = presets?.find((p) => p.id === resident.speechPreset && !p.deleted);
        speechSummary = preset?.label ?? null;
      }

      // 直近の会話から要約取得
      const events = (await listAny("events")) as any[] | null;
      const recentConvos = (events ?? [])
        .filter(
          (e) =>
            e.kind === "conversation" &&
            !e.deleted &&
            Array.isArray(e.payload?.participants) &&
            e.payload.participants.includes(residentId),
        )
        .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
        .slice(0, 2);

      const recentSummaries = recentConvos.map((e) => {
        const lines = Array.isArray(e.payload?.lines) ? e.payload.lines : [];
        const first = lines[0];
        return first?.text ? `${first.speaker ?? "?"}: ${first.text.slice(0, 40)}` : e.payload?.topic ?? "会話があった";
      });

      themeResult = await generateConsultTheme({
        character: {
          name: resident.name ?? "住人",
          gender: resident.gender,
          age: resident.age,
          mbti: resident.mbti,
          traits,
          speechProfileSummary: speechSummary,
        },
        trustBandTone: TRUST_BAND_TONE[trustBand],
        category,
        seed,
        recentSummaries,
      });
    }

    // event 作成
    const eventId = newId();
    const expiresAt = new Date(now.getTime() + CONSULT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    const consultPayload = {
      title: themeResult.title,
      content: themeResult.content,
      choices: themeResult.choices,
      residentId,
      participants,
      triggerEventId: triggerId ?? null,
      category,
      seed,
      trustBand,
      expiresAt,
    };

    await putAny("events", {
      id: eventId,
      kind: "consult",
      payload: consultPayload,
      updated_at: now.toISOString(),
      deleted: false,
    } as any);

    // notification 作成
    const notifId = newId();
    const snippet = themeResult.content.slice(0, 57) + (themeResult.content.length > 57 ? "…" : "");
    await putAny("notifications", {
      id: notifId,
      type: "consult",
      linked_event_id: eventId,
      thread_id: null,
      participants,
      snippet,
      occurred_at: now.toISOString(),
      status: "unread",
      priority: isTransition ? 1 : 0,
      updated_at: now.toISOString(),
    });

    return NextResponse.json({ eventId, consultPayload });
  } catch (error) {
    if (error instanceof KvUnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[Consult Generate API] Failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
