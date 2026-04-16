// apps/web/app/api/consults/generate/route.ts
// 相談生成 API: キャラ情報からGPTで相談テーマを生成し、event + notification を作成

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  putKV as putAny,
  getKV as getAny,
  getRawKV as getRawAny,
  listActiveKV as listActiveAny,
} from "@/lib/db/kv-server";
import { KvUnauthenticatedError } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";
import { generateConsultTheme } from "@/lib/gpt/call-gpt-for-consult";
import { sbServer } from "@/lib/supabase/server";
import {
  getTrustBand,
  pickCategoryAndSeed,
  buildTransitionChoices,
  TRUST_BAND_TONE,
  CONSULT_EXPIRY_HOURS,
} from "@repo/shared/logic/consult";
import { relationTriggerEventPayloadSchema } from "@repo/shared/types/conversation";

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
    const now = new Date();

    // 関係遷移トリガーかどうか判定
    let isTransition = false;
    let triggerEvent: any = null;
    let participants: string[] = [residentId];
    let consultResidentId = residentId;
    let triggerPayload: z.infer<typeof relationTriggerEventPayloadSchema> | null = null;

    if (triggerId) {
      triggerEvent = await getRawAny<any>("events", triggerId);
      if (triggerEvent && (triggerEvent.kind !== "relation_trigger" || triggerEvent.deleted)) {
        triggerEvent = null;
      }
      if (triggerEvent) {
        const payloadParsed = relationTriggerEventPayloadSchema.safeParse(triggerEvent.payload ?? {});
        if (!payloadParsed.success) {
          return NextResponse.json(
            { error: "invalid_trigger_payload", details: payloadParsed.error.flatten() },
            { status: 422 },
          );
        }
        if (payloadParsed.data.handled) {
          return NextResponse.json({ error: "trigger_already_handled" }, { status: 409 });
        }
        isTransition = true;
        triggerPayload = payloadParsed.data;
        consultResidentId = payloadParsed.data.residentId;
        participants = [payloadParsed.data.residentId, payloadParsed.data.targetId];
      }
    }

    // プレイヤー名を取得
    const [playerProfiles, resident] = await Promise.all([
      listActiveAny<any>("player_profiles"),
      getAny<any>("residents", consultResidentId),
    ]);
    const playerName: string | undefined = playerProfiles.find((p) => p.player_name)?.player_name;

    // 住人情報を取得
    if (!resident) {
      return NextResponse.json({ error: "resident_not_found" }, { status: 404 });
    }

    const trust: number = resident.trustToPlayer ?? resident.trust_to_player ?? 50;
    const trustBand = getTrustBand(trust);
    const traits = resident.traits ?? {};

    // テーマ生成
    let themeResult;
    let category: string;
    let seed: string;

    if (isTransition && triggerEvent) {
      // 関係遷移相談: テンプレート選択肢を使用
      const trigger = triggerPayload!.trigger;
      const choices = buildTransitionChoices(trigger);
      category = "relation_transition";
      seed = trigger;

      // 口調プリセット解決
      let speechSummary: string | null = null;
      if (resident.speechPreset) {
        const preset = await getAny<any>("presets", resident.speechPreset);
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
        playerName,
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
        const preset = await getAny<any>("presets", resident.speechPreset);
        speechSummary = preset?.label ?? null;
      }

      // 直近の会話から要約取得
      const sb = sbServer();
      const { data: recentConvos, error: recentConvosError } = await sb
        .from("events")
        .select("*")
        .eq("kind", "conversation")
        .eq("deleted", false)
        .contains("payload", { participants: [consultResidentId] })
        .order("updated_at", { ascending: false })
        .limit(2);
      if (recentConvosError) {
        throw recentConvosError;
      }

      const recentSummaries = (recentConvos ?? []).map((e: any) => {
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
        playerName,
      });
    }

    // event 作成
    const eventId = newId();
    const expiresAt = new Date(now.getTime() + CONSULT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    const consultPayload = {
      title: themeResult.title,
      content: themeResult.content,
      choices: themeResult.choices,
      residentId: consultResidentId,
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
    const snippet = themeResult.content.slice(0, 30) + (themeResult.content.length > 30 ? "…" : "");
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

    // relation_trigger の handled を反映
    if (isTransition && triggerEvent && triggerPayload) {
      await putAny("events", {
        ...triggerEvent,
        payload: {
          ...triggerPayload,
          handled: true,
        },
        updated_at: now.toISOString(),
      });
    }

    return NextResponse.json({ eventId, consultPayload });
  } catch (error) {
    if (error instanceof KvUnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[Consult Generate API] Failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
