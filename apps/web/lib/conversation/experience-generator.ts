import { listKV as listAny, putKV as putAny } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";
import type {
  ExperienceEvent,
  HookIntent,
  ResidentExperience,
} from "@repo/shared/types/conversation";

type ResidentRow = Record<string, unknown>;
type RelationRow = Record<string, unknown>;
type FeelingRow = Record<string, unknown>;
type WorldStateRow = Record<string, unknown>;
type ExperienceEventRow = Record<string, unknown>;
type ResidentExperienceRow = Record<string, unknown>;

type CandidateAppraisal = {
  residentId: string;
  awareness: ResidentExperience["awareness"];
  appraisal: string;
  hookIntent: HookIntent;
  confidence: number;
  salience: number;
};

type ExperienceCandidate = {
  sourceType: ExperienceEvent["sourceType"];
  factSummary: string;
  factDetail?: Record<string, unknown>;
  tags: string[];
  significance: number;
  signature: string;
  occurredAt: string;
  appraisals: CandidateAppraisal[];
  primaryHook: HookIntent;
  pairKey: string;
};

const HOOK_STRENGTH: Record<HookIntent, number> = {
  invite: 30,
  share: 22,
  complain: 28,
  consult: 35,
  reflect: 20,
};

const RELATION_BONUS: Record<string, number> = {
  none: 0,
  acquaintance: 0.03,
  friend: 0.12,
  best_friend: 0.18,
  lover: 0.2,
  family: 0.16,
};

function clamp(input: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, input));
}

function toScore(input: number): number {
  return clamp(Math.round(input), 0, 100);
}

function toMillis(iso: string | null | undefined): number {
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

function parseString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input : undefined;
}

function toExperienceSourceType(input: unknown): ExperienceEvent["sourceType"] | undefined {
  if (input === "lifestyle" || input === "work" || input === "interpersonal" || input === "environment") {
    return input;
  }
  return undefined;
}

function parseResidentId(input: ResidentRow): string | undefined {
  return parseString(input.id);
}

function parseResidentName(input: ResidentRow): string {
  return parseString(input.name) ?? "住人";
}

function parseResidentOccupation(input: ResidentRow): string | undefined {
  return parseString((input as any).occupation);
}

function parseRelationTypeForPair(
  relations: RelationRow[],
  a: string,
  b: string,
): string | undefined {
  const latest = relations
    .filter((row) => {
      if (row.deleted) return false;
      const aId = parseString((row as any).a_id) ?? parseString((row as any).aId);
      const bId = parseString((row as any).b_id) ?? parseString((row as any).bId);
      if (!aId || !bId) return false;
      return (aId === a && bId === b) || (aId === b && bId === a);
    })
    .sort((lhs, rhs) => {
      const l = toMillis(parseString((lhs as any).updated_at) ?? parseString((lhs as any).updatedAt));
      const r = toMillis(parseString((rhs as any).updated_at) ?? parseString((rhs as any).updatedAt));
      return r - l;
    })[0];

  return parseString((latest as any)?.type);
}

function parseFeelingScore(
  feelings: FeelingRow[],
  fromId: string,
  toId: string,
): number | undefined {
  const latest = feelings
    .filter((row) => {
      if (row.deleted) return false;
      const from = parseString((row as any).from_id) ?? parseString((row as any).fromId);
      const to = parseString((row as any).to_id) ?? parseString((row as any).toId);
      return from === fromId && to === toId;
    })
    .sort((lhs, rhs) => {
      const l = toMillis(parseString((lhs as any).updated_at) ?? parseString((lhs as any).updatedAt));
      const r = toMillis(parseString((rhs as any).updated_at) ?? parseString((rhs as any).updatedAt));
      return r - l;
    })[0];

  const score = Number((latest as any)?.score);
  return Number.isFinite(score) ? score : undefined;
}

function parseWeatherKind(states: WorldStateRow[]): string | undefined {
  const latest = states
    .filter((row) => !row.deleted)
    .sort((lhs, rhs) => {
      const l = toMillis(parseString((lhs as any).updated_at));
      const r = toMillis(parseString((rhs as any).updated_at));
      return r - l;
    })[0];
  const weatherCurrent = (latest as any)?.weather_current ?? (latest as any)?.weatherCurrent;
  return parseString((weatherCurrent as any)?.kind);
}

function slotByHour(now: Date): "morning" | "day" | "evening" | "night" {
  const hour = now.getUTCHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function placeBySlot(slot: ReturnType<typeof slotByHour>): string {
  switch (slot) {
    case "morning":
      return "駅前カフェ";
    case "day":
      return "商店街";
    case "evening":
      return "川沿い公園";
    case "night":
      return "コンビニ";
  }
}

function buildSignature(input: {
  sourceType: ExperienceEvent["sourceType"];
  pair: [string, string];
  place: string;
  hook: HookIntent;
}): string {
  const sortedPair = [...input.pair].sort();
  return `${input.sourceType}:${sortedPair[0]}:${sortedPair[1]}:${input.place}:${input.hook}`;
}

function appraisalStrength(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  return clamp(normalized.length * 4, 0, 60);
}

function hasConcreteWord(input: ExperienceCandidate): boolean {
  const fact = input.factSummary;
  const detail = input.factDetail ?? {};
  const place = parseString(detail.place);
  const target = parseString(detail.target);
  const actor = parseString(detail.actor);
  if (place || target || actor) return true;
  const nounLike = fact.match(/[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? [];
  return nounLike.length > 0;
}

export function validateExperienceCandidate(candidate: ExperienceCandidate): boolean {
  if (!hasConcreteWord(candidate)) return false;
  if (!Array.isArray(candidate.appraisals) || candidate.appraisals.length === 0) return false;

  let hasStateChange = false;
  const before = candidate.factDetail?.before;
  const after = candidate.factDetail?.after;
  if (before != null && after != null) {
    hasStateChange = true;
  }

  for (const appraisal of candidate.appraisals) {
    if (!appraisal.appraisal.trim()) return false;
    if (!(appraisal.hookIntent in HOOK_STRENGTH)) return false;
    const score = appraisalStrength(appraisal.appraisal) + HOOK_STRENGTH[appraisal.hookIntent];
    if (!hasStateChange && score < 60) return false;
  }
  return true;
}

function getVariationConfig(): { hourlyCap: number; calmHours: number } {
  const mode = (process.env.NEXT_PUBLIC_EXPERIENCE_VARIATION ?? "normal").toLowerCase();
  if (mode === "high") return { hourlyCap: 3, calmHours: 1 };
  if (mode === "low") return { hourlyCap: 1, calmHours: 3 };
  return { hourlyCap: 2, calmHours: 2 };
}

function isRumorEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_EXPERIENCE_RUMOR ?? "on").toLowerCase() !== "off";
}

function parseExistingExperienceRows(rows: ExperienceEventRow[]): Array<{
  id: string;
  sourceType: ExperienceEvent["sourceType"];
  signature: string;
  occurredAt: string;
  pairKey: string | undefined;
}> {
  return rows
    .filter((row) => !row.deleted)
    .map((row) => {
      const id = parseString(row.id);
      const sourceType = toExperienceSourceType(
        parseString((row as any).source_type) ?? parseString((row as any).sourceType),
      );
      const signature = parseString((row as any).signature);
      const occurredAt = parseString((row as any).occurred_at) ?? parseString((row as any).occurredAt);
      if (!id || !signature || !occurredAt) return null;
      if (!sourceType) return null;
      const detail = ((row as any).fact_detail ?? (row as any).factDetail ?? {}) as Record<string, unknown>;
      return {
        id,
        sourceType,
        signature,
        occurredAt,
        pairKey: parseString(detail.pairKey),
      };
    })
    .filter((row): row is {
      id: string;
      sourceType: ExperienceEvent["sourceType"];
      signature: string;
      occurredAt: string;
      pairKey: string | undefined;
    } => row !== null);
}

function isWithinHours(iso: string, nowMs: number, hours: number): boolean {
  const delta = nowMs - toMillis(iso);
  return delta >= 0 && delta <= hours * 60 * 60 * 1000;
}

function shouldSkipByCooldown(input: {
  candidate: ExperienceCandidate;
  existingEvents: Array<{
    sourceType: ExperienceEvent["sourceType"];
    signature: string;
    occurredAt: string;
    pairKey: string | undefined;
    id: string;
  }>;
  residentExperiences: ResidentExperienceRow[];
  nowMs: number;
}): boolean {
  const { candidate, existingEvents, nowMs } = input;

  if (existingEvents.some((event) => event.signature === candidate.signature && isWithinHours(event.occurredAt, nowMs, 36))) {
    return true;
  }

  if (
    existingEvents.some((event) => (
      event.sourceType === candidate.sourceType
      && event.pairKey === candidate.pairKey
      && isWithinHours(event.occurredAt, nowMs, 12)
    ))
  ) {
    return true;
  }

  const eventById = new Map(existingEvents.map((event) => [event.id, event]));
  const hookDup = input.residentExperiences.some((row) => {
    if (row.deleted) return false;
    const hook = parseString((row as any).hook_intent) ?? parseString((row as any).hookIntent);
    if (hook !== candidate.primaryHook) return false;
    const learnedAt = parseString((row as any).learned_at) ?? parseString((row as any).learnedAt);
    if (!learnedAt || !isWithinHours(learnedAt, nowMs, 8)) return false;
    const experienceId = parseString((row as any).experience_id) ?? parseString((row as any).experienceId);
    if (!experienceId) return false;
    const event = eventById.get(experienceId);
    return event?.pairKey === candidate.pairKey;
  });

  return hookDup;
}

function calmTimeReached(input: {
  existingEvents: Array<{ occurredAt: string }>;
  nowMs: number;
  calmHours: number;
}): boolean {
  return input.existingEvents.some((event) => isWithinHours(event.occurredAt, input.nowMs, input.calmHours));
}

function overHourlyCap(input: {
  existingEvents: Array<{ occurredAt: string }>;
  nowMs: number;
  hourlyCap: number;
}): boolean {
  const count = input.existingEvents.filter((event) => isWithinHours(event.occurredAt, input.nowMs, 1)).length;
  return count >= input.hourlyCap;
}

function buildRumorRows(input: {
  residents: ResidentRow[];
  relations: RelationRow[];
  participants: [string, string];
  candidate: ExperienceCandidate;
  nowIso: string;
}): CandidateAppraisal[] {
  if (!isRumorEnabled()) return [];

  const [a, b] = input.participants;
  const actor = parseString(input.candidate.factDetail?.actor) ?? a;
  const baseSalience = toScore(input.candidate.significance - 20);
  const baseConfidence = toScore(60);

  const relationMap = new Map<string, string>();
  for (const row of input.relations) {
    if (row.deleted) continue;
    const aId = parseString((row as any).a_id) ?? parseString((row as any).aId);
    const bId = parseString((row as any).b_id) ?? parseString((row as any).bId);
    const type = parseString((row as any).type) ?? "none";
    if (!aId || !bId) continue;
    relationMap.set(`${aId}:${bId}`, type);
  }

  const rows: CandidateAppraisal[] = [];
  for (const resident of input.residents) {
    const residentId = parseResidentId(resident);
    if (!residentId || residentId === a || residentId === b) continue;

    const relationType = relationMap.get(`${residentId}:${actor}`) ?? relationMap.get(`${actor}:${residentId}`) ?? "none";
    const relationBonus = RELATION_BONUS[relationType] ?? 0;
    const salienceBonus = (input.candidate.significance / 100) * 0.15;
    const recencyBonus = 0.05;
    const distancePenalty = 0.05;
    const p = clamp(0.05 + relationBonus + salienceBonus + recencyBonus - distancePenalty, 0, 0.45);
    if (p < 0.2) continue;

    rows.push({
      residentId,
      awareness: "heard",
      appraisal: `${parseResidentName(resident)}はその話を聞いて少し気になっている`,
      hookIntent: "share",
      confidence: toScore(baseConfidence - 20),
      salience: baseSalience,
    });
  }

  return rows;
}

export function buildExperienceCandidates(input: {
  participants: [string, string];
  residents: ResidentRow[];
  relations: RelationRow[];
  feelings: FeelingRow[];
  weatherKind?: string;
  nowIso: string;
}): ExperienceCandidate[] {
  const [a, b] = input.participants;
  const now = new Date(input.nowIso);
  const slot = slotByHour(now);
  const place = placeBySlot(slot);
  const pairKey = [...input.participants].sort().join(":");
  const byId = new Map<string, ResidentRow>();
  for (const row of input.residents) {
    const id = parseResidentId(row);
    if (id) byId.set(id, row);
  }
  const aName = parseResidentName(byId.get(a) ?? { id: a, name: a });
  const bName = parseResidentName(byId.get(b) ?? { id: b, name: b });
  const relationType = parseRelationTypeForPair(input.relations, a, b) ?? "acquaintance";
  const aToB = parseFeelingScore(input.feelings, a, b) ?? 50;
  const bToA = parseFeelingScore(input.feelings, b, a) ?? 50;

  const candidates: ExperienceCandidate[] = [];

  candidates.push({
    sourceType: "lifestyle",
    factSummary: `${aName}が${place}に立ち寄り、${bName}と少し話した`,
    factDetail: {
      actor: a,
      target: b,
      place,
      pairKey,
      before: "busy",
      after: "calm",
    },
    tags: ["lifestyle", "outing", "pair"],
    significance: relationType === "friend" || relationType === "best_friend" ? 62 : 52,
    signature: buildSignature({
      sourceType: "lifestyle",
      pair: input.participants,
      place,
      hook: relationType === "friend" ? "invite" : "share",
    }),
    occurredAt: input.nowIso,
    appraisals: [
      {
        residentId: a,
        awareness: "direct",
        appraisal: relationType === "friend" ? "想像より楽しくてまた行きたくなった" : "少し気分転換になった",
        hookIntent: relationType === "friend" ? "invite" : "share",
        confidence: 86,
        salience: 72,
      },
      {
        residentId: b,
        awareness: "witnessed",
        appraisal: "短い時間でも話せて気持ちが落ち着いた",
        hookIntent: "share",
        confidence: 72,
        salience: 64,
      },
    ],
    primaryHook: relationType === "friend" ? "invite" : "share",
    pairKey,
  });

  if (input.weatherKind === "rain" || input.weatherKind === "storm") {
    candidates.push({
      sourceType: "environment",
      factSummary: `${aName}と${bName}が帰り道で雨に当たった`,
      factDetail: {
        actor: a,
        target: b,
        place: "帰り道",
        pairKey,
      },
      tags: ["environment", "weather", input.weatherKind],
      significance: input.weatherKind === "storm" ? 70 : 55,
      signature: buildSignature({
        sourceType: "environment",
        pair: input.participants,
        place: "帰り道",
        hook: "complain",
      }),
      occurredAt: input.nowIso,
      appraisals: [
        {
          residentId: a,
          awareness: "direct",
          appraisal: "雨で移動が大変だったけど無事に着けてほっとした",
          hookIntent: "complain",
          confidence: 88,
          salience: 78,
        },
        {
          residentId: b,
          awareness: "direct",
          appraisal: "服が濡れて少し疲れたので誰かに聞いてほしい",
          hookIntent: "share",
          confidence: 74,
          salience: 66,
        },
      ],
      primaryHook: "complain",
      pairKey,
    });
  }

  if (aToB <= 35 || bToA <= 35) {
    candidates.push({
      sourceType: "interpersonal",
      factSummary: `${aName}と${bName}が待ち合わせですれ違った`,
      factDetail: {
        actor: a,
        target: b,
        place: "駅前",
        pairKey,
        before: "smooth",
        after: "awkward",
      },
      tags: ["interpersonal", "awkward"],
      significance: 68,
      signature: buildSignature({
        sourceType: "interpersonal",
        pair: input.participants,
        place: "駅前",
        hook: "consult",
      }),
      occurredAt: input.nowIso,
      appraisals: [
        {
          residentId: a,
          awareness: "direct",
          appraisal: "少し気まずくて、どう声をかければよいか迷っている",
          hookIntent: "consult",
          confidence: 82,
          salience: 74,
        },
      ],
      primaryHook: "consult",
      pairKey,
    });
  }

  const occupationA = parseResidentOccupation(byId.get(a) ?? {});
  if (occupationA) {
    candidates.push({
      sourceType: "work",
      factSummary: `${aName}が仕事先で想定外の対応をこなした`,
      factDetail: {
        actor: a,
        target: b,
        place: "仕事先",
        pairKey,
      },
      tags: ["work", "trouble"],
      significance: 58,
      signature: buildSignature({
        sourceType: "work",
        pair: input.participants,
        place: "仕事先",
        hook: "reflect",
      }),
      occurredAt: input.nowIso,
      appraisals: [
        {
          residentId: a,
          awareness: "direct",
          appraisal: "大変だったが終わってから少し面白く感じた",
          hookIntent: "reflect",
          confidence: 80,
          salience: 68,
        },
      ],
      primaryHook: "reflect",
      pairKey,
    });
  }

  return candidates;
}

function toVariationBoost(candidate: ExperienceCandidate): number {
  if (candidate.factDetail?.before != null && candidate.factDetail?.after != null) {
    return 10;
  }
  return 0;
}

export async function generateAndPersistExperienceForParticipants(input: {
  participants: [string, string];
  nowIso?: string;
}): Promise<{ created: boolean; reason?: string; eventId?: string }> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = toMillis(nowIso);
  const config = getVariationConfig();

  const [residentsRaw, relationsRaw, feelingsRaw, worldStatesRaw, existingEventsRaw, existingResidentExpRaw] = await Promise.all([
    listAny("residents") as Promise<ResidentRow[]>,
    listAny("relations") as Promise<RelationRow[]>,
    listAny("feelings") as Promise<FeelingRow[]>,
    listAny("world_states") as Promise<WorldStateRow[]>,
    listAny("experience_events") as Promise<ExperienceEventRow[]>,
    listAny("resident_experiences") as Promise<ResidentExperienceRow[]>,
  ]);

  const residents = Array.isArray(residentsRaw) ? residentsRaw.filter((row) => !row.deleted) : [];
  const relations = Array.isArray(relationsRaw) ? relationsRaw : [];
  const feelings = Array.isArray(feelingsRaw) ? feelingsRaw : [];
  const weatherKind = parseWeatherKind(Array.isArray(worldStatesRaw) ? worldStatesRaw : []);
  const existingEvents = parseExistingExperienceRows(Array.isArray(existingEventsRaw) ? existingEventsRaw : []);
  const existingResidentExp = Array.isArray(existingResidentExpRaw) ? existingResidentExpRaw : [];

  if (overHourlyCap({ existingEvents, nowMs, hourlyCap: config.hourlyCap })) {
    return { created: false, reason: "hourly_cap" };
  }
  if (calmTimeReached({ existingEvents, nowMs, calmHours: config.calmHours })) {
    return { created: false, reason: "calm_time" };
  }

  const candidates = buildExperienceCandidates({
    participants: input.participants,
    residents,
    relations,
    feelings,
    weatherKind,
    nowIso,
  })
    .map((candidate) => ({
      ...candidate,
      significance: toScore(candidate.significance + toVariationBoost(candidate)),
    }))
    .filter((candidate) => validateExperienceCandidate(candidate))
    .filter((candidate) => !shouldSkipByCooldown({
      candidate,
      existingEvents,
      residentExperiences: existingResidentExp,
      nowMs,
    }))
    .sort((lhs, rhs) => rhs.significance - lhs.significance);

  const selected = candidates[0];
  if (!selected) return { created: false, reason: "no_candidate" };

  const rumorRows = buildRumorRows({
    residents,
    relations,
    participants: input.participants,
    candidate: selected,
    nowIso,
  });

  const eventId = newId();
  await putAny("experience_events", {
    id: eventId,
    source_type: selected.sourceType,
    source_ref: null,
    fact_summary: selected.factSummary,
    fact_detail: selected.factDetail ?? {},
    tags: selected.tags,
    significance: selected.significance,
    signature: selected.signature,
    occurred_at: selected.occurredAt,
    updated_at: nowIso,
    deleted: false,
  });

  const allResidentRows = [...selected.appraisals, ...rumorRows];
  for (const row of allResidentRows) {
    await putAny("resident_experiences", {
      id: newId(),
      experience_id: eventId,
      resident_id: row.residentId,
      awareness: row.awareness,
      appraisal: row.appraisal,
      hook_intent: row.hookIntent,
      confidence: toScore(row.confidence),
      salience: toScore(row.salience),
      learned_at: nowIso,
      expires_at: new Date(toMillis(nowIso) + 72 * 60 * 60 * 1000).toISOString(),
      updated_at: nowIso,
      deleted: false,
    });
  }

  return { created: true, eventId };
}
