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
import {
  calculateConfessionSuccessRate,
  computeImpressionOnTransition,
} from "@repo/shared/logic/relation-transition";
import {
  relationTriggerEventPayloadSchema,
  type ImpressionBase,
} from "@repo/shared/types/conversation";
import { DEFAULT_FEELING_SCORE } from "@repo/shared/types";
import { newId } from "@/lib/newId";
import { normalizeRelationPair } from "@/lib/data/relation-pair";

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

    // プレイヤー名を取得
    const playerProfiles = (await listAny("player_profiles")) as any[] | null;
    const playerName: string | undefined = playerProfiles?.find((p) => !p.deleted)?.player_name;

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
      playerName,
    });

    // 判定基準は「選択肢定義の favorability」を正とする
    const selectedFavorability =
      selectedChoice?.favorability === "positive" ||
      selectedChoice?.favorability === "neutral" ||
      selectedChoice?.favorability === "negative"
        ? selectedChoice.favorability
        : undefined;
    const favorability = (selectedFavorability ?? replyResult.favorability ?? "neutral") as Favorability;
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

    // 関係遷移相談の回答後確定処理（trust更新の後段）
    if (consultPayload.triggerEventId) {
      await handleTransitionConsultAnswer({
        consultPayload,
        residents: residents ?? [],
        events: events ?? [],
        favorability,
        now,
      });
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
 * 関係遷移相談の回答後に、関係・印象を確定する。
 */
async function handleTransitionConsultAnswer(params: {
  consultPayload: any;
  residents: any[];
  events: any[];
  favorability: Favorability;
  now: string;
}) {
  const triggerEvent = params.events.find(
    (e) => e.id === params.consultPayload.triggerEventId && e.kind === "relation_trigger" && !e.deleted,
  );
  if (!triggerEvent) return;

  const parsed = relationTriggerEventPayloadSchema.safeParse(triggerEvent.payload ?? {});
  if (!parsed.success) return;

  const triggerPayload = parsed.data;
  const { trigger, residentId, targetId } = triggerPayload;

  // negative は現行維持（印象リセット + 7日クールダウン）
  if (params.favorability === "negative") {
    await handleNegativeTransitionAnswer({
      triggerPayload,
      now: params.now,
    });
    return;
  }

  const relations = (await listAny("relations")) as any[] | null;
  const feelings = (await listAny("feelings")) as any[] | null;

  const relation = (relations ?? []).find((r) => {
    const ra = r.a_id ?? r.aId;
    const rb = r.b_id ?? r.bId;
    return !r.deleted && ((ra === residentId && rb === targetId) || (ra === targetId && rb === residentId));
  });
  const currentRelation = String(relation?.type ?? triggerPayload.currentRelation ?? "friend");

  const feelingResidentToTarget = (feelings ?? []).find(
    (f) => !f.deleted && f.from_id === residentId && f.to_id === targetId,
  );
  const feelingTargetToResident = (feelings ?? []).find(
    (f) => !f.deleted && f.from_id === targetId && f.to_id === residentId,
  );

  const favorResidentToTarget = normalizeFeelingScore(feelingResidentToTarget?.score);
  const favorTargetToResident = normalizeFeelingScore(feelingTargetToResident?.score);

  const impressionResidentToTarget = normalizeImpressionBase(feelingResidentToTarget?.label);
  const impressionTargetToResident = normalizeImpressionBase(feelingTargetToResident?.label);

  if (trigger === "confession") {
    const targetResident = params.residents.find((r) => r.id === targetId && !r.deleted);
    const targetEmpathy = Number(targetResident?.traits?.empathy ?? 3);

    const baseRate = calculateConfessionSuccessRate({
      targetFavor: favorTargetToResident,
      targetImpression: impressionTargetToResident,
      targetEmpathy,
    });
    const boostedRate = params.favorability === "positive" ? baseRate + 0.1 : baseRate;
    const successRate = Math.max(0, Math.min(1, boostedRate));
    const success = Math.random() < successRate;

    if (success) {
      await updateRelationType({
        relation,
        residentId,
        targetId,
        newType: "lover",
        now: params.now,
      });
      await updateFeelingLabel(feelingResidentToTarget, residentId, targetId, "like", params.now);
      await updateFeelingLabel(feelingTargetToResident, targetId, residentId, "like", params.now);
      await recordRelationTransitionEvent({
        participants: [residentId, targetId],
        from: currentRelation,
        to: "lover",
        subType: "confession_success",
        now: params.now,
      });
    } else {
      await updateFeelingLabel(feelingResidentToTarget, residentId, targetId, "awkward", params.now);
      await updateFeelingLabel(feelingTargetToResident, targetId, residentId, "awkward", params.now);
    }
    return;
  }

  // breakup: positive / neutral で friend へ降格
  const { newImpressionA, newImpressionB } = computeImpressionOnTransition({
    currentRelation,
    newRelation: "friend",
    favorA: favorResidentToTarget,
    favorB: favorTargetToResident,
    currentImpressionA: impressionResidentToTarget,
    currentImpressionB: impressionTargetToResident,
  });

  await updateRelationType({
    relation,
    residentId,
    targetId,
    newType: "friend",
    now: params.now,
  });
  await updateFeelingLabel(feelingResidentToTarget, residentId, targetId, newImpressionA, params.now);
  await updateFeelingLabel(feelingTargetToResident, targetId, residentId, newImpressionB, params.now);
  await recordRelationTransitionEvent({
    participants: [residentId, targetId],
    from: currentRelation,
    to: "friend",
    subType: "breakup_success",
    now: params.now,
  });
}

function normalizeImpressionBase(value: unknown, fallback: ImpressionBase = "none"): ImpressionBase {
  const allowed: ImpressionBase[] = [
    "dislike",
    "maybe_dislike",
    "none",
    "curious",
    "maybe_like",
    "like",
    "love",
  ];
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as ImpressionBase;
  }
  return fallback;
}

function normalizeFeelingScore(value: unknown, fallback = DEFAULT_FEELING_SCORE): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function updateRelationType(params: {
  relation: any;
  residentId: string;
  targetId: string;
  newType: string;
  now: string;
}) {
  const base = params.relation ?? (() => {
    const pair = normalizeRelationPair(params.residentId, params.targetId);
    return {
      id: newId(),
      a_id: pair.aId,
      b_id: pair.bId,
      deleted: false,
    };
  })();
  await putAny("relations", {
    ...base,
    type: params.newType,
    updated_at: params.now,
  });
}

async function updateFeelingLabel(
  feeling: any,
  fromId: string,
  toId: string,
  label: string,
  now: string,
) {
  const base = feeling ?? {
    id: newId(),
    from_id: fromId,
    to_id: toId,
    score: DEFAULT_FEELING_SCORE,
    deleted: false,
  };
  const normalizedCurrentBase = normalizeImpressionBase(
    base.base_label ?? (base.label === "awkward" ? "none" : base.label),
  );
  const normalizedBaseBeforeSpecial = normalizeImpressionBase(
    base.base_before_special,
    normalizedCurrentBase,
  );

  const isAwkward = label === "awkward";
  const nextBaseLabel = isAwkward ? normalizedCurrentBase : normalizeImpressionBase(label);
  const nextSpecialLabel = isAwkward ? "awkward" : null;
  const nextBaseBeforeSpecial = isAwkward
    ? normalizedBaseBeforeSpecial
    : null;

  await putAny("feelings", {
    ...base,
    from_id: fromId,
    to_id: toId,
    score: normalizeFeelingScore(base.score),
    label: isAwkward ? "awkward" : nextBaseLabel,
    base_label: nextBaseLabel,
    special_label: nextSpecialLabel,
    base_before_special: nextBaseBeforeSpecial,
    updated_at: now,
  });
}

async function recordRelationTransitionEvent(params: {
  participants: [string, string];
  from: string;
  to: string;
  subType: string;
  now: string;
}) {
  await putAny("events", {
    id: newId(),
    kind: "system",
    payload: {
      type: "relation_transition",
      subType: params.subType,
      participants: params.participants,
      from: params.from,
      to: params.to,
    },
    updated_at: params.now,
    deleted: false,
  } as any);
}

/**
 * 関係遷移相談で「止める」を選択した場合の処理:
 * 1. 印象リセット（告白: maybe_like → curious、別れ: dislike → none）
 * 2. クールダウン記録（7日間再発行しない）
 */
async function handleNegativeTransitionAnswer(params: {
  triggerPayload: z.infer<typeof relationTriggerEventPayloadSchema>;
  now: string;
}) {
  const { trigger, residentId, targetId } = params.triggerPayload;

  // 印象リセット（主体→相手）
  const feelings = (await listAny("feelings")) as any[] | null;
  const feeling = (feelings ?? []).find(
    (f) => !f.deleted && f.from_id === residentId && f.to_id === targetId,
  );
  if (feeling) {
    let newLabel: string | null = null;
    if (trigger === "confession" && feeling.label === "maybe_like") {
      newLabel = "curious";
    } else if (trigger === "breakup" && feeling.label === "dislike") {
      newLabel = "none";
    }

    if (newLabel) {
      await updateFeelingLabel(
        feeling,
        residentId,
        targetId,
        newLabel,
        params.now,
      );
    }
  }

  // クールダウン記録
  const pair = [residentId, targetId].sort().join(":");
  const expiresAt = new Date(
    new Date(params.now).getTime() + CONSULT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await putAny("events", {
    id: newId(),
    kind: "consult_cooldown",
    payload: { pair, trigger, expiresAt },
    updated_at: params.now,
    deleted: false,
  } as any);
}
