// apps/web/app/api/consults/[id]/answer/route.ts
// 相談回答処理 API: GPT返答生成 + trustDelta計算 + event更新

import { NextResponse } from "next/server";
import { z } from "zod";
import { putKV as putAny, listKV as listAny } from "@/lib/db/kv-server";
import { KvUnauthenticatedError } from "@/lib/db/kv-server";
import { generateConsultReply } from "@/lib/gpt/call-gpt-for-consult";
import {
  calcTrustDelta,
  getTrustBand,
  TRUST_BAND_TONE,
  CONSULT_COOLDOWN_DAYS,
  type Favorability,
} from "@repo/shared/logic/consult";
import { newId } from "@/lib/newId";

const answerRequestSchema = z.object({
  selectedChoiceId: z.string(),
});

export async function POST(
  req: Request,
  ctx: { params: { id: string } },
) {
  const consultId = ctx?.params?.id;
  if (!consultId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = answerRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { selectedChoiceId } = parsed.data;

  try {
    // consult event を取得
    const events = (await listAny("events")) as any[] | null;
    const consultEvent = events?.find(
      (e) => e.id === consultId && e.kind === "consult" && !e.deleted,
    );
    if (!consultEvent) {
      return NextResponse.json({ error: "consult_not_found" }, { status: 404 });
    }

    const consultPayload = consultEvent.payload ?? {};

    // 既に回答済みチェック
    if (consultPayload.selectedChoiceId) {
      return NextResponse.json({ error: "already_answered" }, { status: 409 });
    }

    // 住人情報を取得
    const residentId = consultPayload.residentId;
    const residents = (await listAny("residents")) as any[] | null;
    const resident = residents?.find((r) => r.id === residentId && !r.deleted);
    if (!resident) {
      return NextResponse.json({ error: "resident_not_found" }, { status: 404 });
    }

    // 選択肢を復元
    const choices = Array.isArray(consultPayload.choices) ? consultPayload.choices : [];
    const selectedChoice = choices.find((c: any) => c.id === selectedChoiceId);
    if (!selectedChoice) {
      return NextResponse.json({ error: "invalid_choice" }, { status: 400 });
    }

    const traits = resident.traits ?? {};
    const trust: number = resident.trustToPlayer ?? resident.trust_to_player ?? 50;
    const trustBand = getTrustBand(trust);

    // 口調プリセット解決
    let speechSummary: string | null = null;
    if (resident.speechPreset) {
      const presets = (await listAny("presets")) as any[] | null;
      const preset = presets?.find((p) => p.id === resident.speechPreset && !p.deleted);
      speechSummary = preset?.label ?? null;
    }

    // GPT 返答生成
    const replyResult = await generateConsultReply({
      character: {
        name: resident.name ?? "住人",
        gender: resident.gender,
        age: resident.age,
        mbti: resident.mbti,
        traits,
        speechProfileSummary: speechSummary,
      },
      trustBandTone: TRUST_BAND_TONE[trustBand],
      consultContent: consultPayload.content ?? "",
      selectedChoiceLabel: selectedChoice.label,
    });

    // trustDelta をコード側で算出
    const favorability = replyResult.favorability as Favorability;
    const trustDelta = calcTrustDelta({
      favorability,
      traits: {
        empathy: traits.empathy ?? 3,
        stubbornness: traits.stubbornness ?? 3,
        expressiveness: traits.expressiveness ?? 3,
      },
    });

    const trustBefore = trust;
    const trustAfter = Math.max(0, Math.min(100, Math.round(trustBefore + trustDelta)));
    const now = new Date().toISOString();

    // resident.trustToPlayer を更新
    await putAny("residents", {
      ...resident,
      trustToPlayer: trustAfter,
      trust_to_player: trustAfter,
      updated_at: now,
    });

    // systemAfter 構築
    const systemAfter: string[] = [];
    if (trustDelta > 0) systemAfter.push("信頼度：↑");
    else if (trustDelta < 0) systemAfter.push("信頼度：↓");

    // event payload を更新
    const updatedPayload = {
      ...consultPayload,
      selectedChoiceId,
      reply: replyResult.reply,
      favorability,
      trustDelta,
      trustBefore,
      trustAfter,
      answeredAt: now,
      systemAfter,
    };

    await putAny("events", {
      id: consultId,
      kind: "consult",
      payload: updatedPayload,
      updated_at: now,
      deleted: false,
    } as any);

    // 関係遷移相談 + 「止める」の場合の処理
    if (consultPayload.triggerEventId && favorability === "negative") {
      await handleNegativeTransitionAnswer(
        consultPayload,
        residents ?? [],
        events ?? [],
        now,
      );
    }

    return NextResponse.json({
      reply: replyResult.reply,
      favorability,
      trustDelta,
      trustBefore,
      trustAfter,
    });
  } catch (error) {
    if (error instanceof KvUnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[Consult Answer API] Failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/**
 * 関係遷移相談で「止める」を選択した場合の処理:
 * 1. 印象リセット（告白: maybe_like → curious、別れ: dislike → none）
 * 2. クールダウン記録（7日間再発行しない）
 */
async function handleNegativeTransitionAnswer(
  consultPayload: any,
  residents: any[],
  events: any[],
  now: string,
) {
  const triggerEvent = events.find(
    (e) => e.id === consultPayload.triggerEventId && !e.deleted,
  );
  if (!triggerEvent) return;

  const trigger = triggerEvent.payload?.trigger;
  const participants = Array.isArray(consultPayload.participants)
    ? consultPayload.participants
    : [];

  if (participants.length < 2) return;

  // 印象リセット
  const feelings = (await listAny("feelings")) as any[] | null;
  if (feelings) {
    const subjectDir = triggerEvent.payload?.subjectDirection;
    const [a, b] = participants;
    const subjectId = subjectDir === "b" ? b : a;

    const feeling = feelings.find(
      (f) => f.from_id === subjectId && participants.includes(f.to_id) && !f.deleted,
    );

    if (feeling) {
      let newLabel: string | null = null;
      if (trigger === "confession" && feeling.label === "maybe_like") {
        newLabel = "curious";
      } else if (trigger === "breakup" && feeling.label === "dislike") {
        newLabel = "none";
      }

      if (newLabel) {
        await putAny("feelings", {
          ...feeling,
          label: newLabel,
          updated_at: now,
        });
      }
    }
  }

  // クールダウン記録
  const pair = [...participants].sort().join(":");
  const expiresAt = new Date(
    new Date(now).getTime() + CONSULT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await putAny("events", {
    id: newId(),
    kind: "consult_cooldown",
    payload: { pair, trigger, expiresAt },
    updated_at: now,
    deleted: false,
  } as any);
}
