'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Preset as PresetType, PresetCategory as PresetCategoryType } from '@/types';
import { listLocal, putLocal, getLocal, markDeleted, removeLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import { supabaseClient } from '@/lib/db-cloud/supabase';

export type Preset = PresetType;
export type PresetCategory = PresetCategoryType;

type DefaultPresetTemplate = {
  legacyId: string;
  category: PresetCategory;
  label: string;
  description: string | null;
  example?: string | null;
  speechProfileData?: Preset['speechProfileData'];
};

export const DEFAULT_PRESETS_VERSION = 1;
const BOOTSTRAP_STORAGE_PREFIX = 'reladen:preset-bootstrap';
const KEY = ['presets'];

const DEFAULT_PRESET_TEMPLATES_BASE: ReadonlyArray<DefaultPresetTemplate> = [
  {
    legacyId: 'fdc5f580-a7c6-dbb1-28f6-64ad237831aa',
    category: 'speech',
    label: '優しい敬語',
    description: '丁寧で穏やかな話し方：「〜です」「〜ます」など',
    example: '今日はいい感じですね。',
    speechProfileData: {
      endings: ['〜です', '〜ますね', '〜ですよ'],
      frequentPhrases: ['そうですね', 'ありがとうございます'],
      avoidedPhrases: ['マジで', 'やべえ'],
      examples: ['今日はいい天気ですね。', 'お元気でしたか？'],
    },
  },
  {
    legacyId: '33ff24b3-0861-6bc0-7aa0-4ac350fe5c51',
    category: 'speech',
    label: '冷たい敬語',
    description: '距離感のある敬語：「ご自由にどうぞ」「そうですか」など',
    example: '今日、いい感じですね。',
    speechProfileData: {
      endings: ['〜ですか', '〜ですね', '〜では？'],
      frequentPhrases: ['そうですが', 'いい感じですね', 'ご自由にどうぞ'],
      avoidedPhrases: ['マジで', 'やべえ'],
      examples: ['今日はいい天気ですね。', 'お好きにしてください'],
    },
  },
  {
    legacyId: 'a24b66df-0f96-e060-26ee-6e153dd14754',
    category: 'speech',
    label: 'タメ口',
    description: 'フレンドリーな砕けた口調：「〜だよ」「〜じゃん」など',
    example: '今日いい感じじゃん。',
    speechProfileData: {
      endings: ['〜だね', '〜じゃない', '〜だよ', '〜じゃん'],
      frequentPhrases: ['いいね', 'ありがと', 'どう？'],
      avoidedPhrases: ['しましょう', '思います'],
      examples: ['今日はいい天気だね。', '元気？'],
    },
  },
  {
    legacyId: '7d4ffa4f-e0cb-19d2-85f1-27ff467cef0a',
    category: 'speech',
    label: 'ギャル語',
    description: '砕けた陽気な話し方：「マジで？」「〜じゃね？」など',
    example: '今日、いい感じじゃね？',
    speechProfileData: {
      endings: ['〜じゃね？', '〜でしょ', '〜よね'],
      frequentPhrases: ['マジで？', 'いいじゃん', 'よすぎる'],
      avoidedPhrases: ['思います', 'いいですね'],
      examples: ['今日マジでいい天気じゃね？', 'やっぱこれっしょ！'],
    },
  },
  {
    legacyId: 'd4498811-d12f-a38a-7eec-474dc908b26f',
    category: 'speech',
    label: 'お嬢様風',
    description: '上品で古風な敬語：「〜ですわ」「〜ですこと」など',
    example: '今日はいい感じですわね。',
    speechProfileData: {
      endings: ['〜ですわ', '〜かしら', '〜ですこと'],
      frequentPhrases: ['そうですわね', '助かりましたわ', 'よろしくお願いしますわ'],
      avoidedPhrases: ['マジで', 'やべえ'],
      examples: ['今日はいい天気ですわね。', 'ご機嫌いかがかしら？'],
    },
  },
  {
    legacyId: '5d603d72-66c7-90d8-9259-5c804e412bdc',
    category: 'speech',
    label: '関西弁',
    description: '柔らかい関西口調：「〜やで」「ほんま？」など',
    example: '今日いい感じやね。',
    speechProfileData: {
      endings: ['〜やね', '〜やで', '〜せん'],
      frequentPhrases: ['そうやんな', 'ありがとな', 'こうやで'],
      avoidedPhrases: ['そうです', '思います'],
      examples: ['今日いい天気やね。', '元気やった？', 'ほんまおもろいなぁ'],
    },
  },
  {
    legacyId: 'b3ff700f-489a-f3b3-c491-f115c00536b4',
    category: 'speech',
    label: '子供っぽい',
    description: '無邪気で幼い印象の話し方：「〜だね！」「やったぁ」など',
    example: '今日はいい感じだね！',
    speechProfileData: {
      endings: ['〜だね！', '〜もん', '〜じゃん'],
      frequentPhrases: ['やったぁ', 'ありがとう！', 'そうだよね！'],
      avoidedPhrases: ['思います', 'やべえ'],
      examples: ['今日はいい天気だね！。', 'わくわくしてきた', '楽しんじゃおう'],
    },
  },
  {
    legacyId: 'd58d88d7-abb1-90bc-d6d3-0d1723c67349',
    category: 'speech',
    label: '無口',
    description: '短く省略がち：「……別に」「うん」など',
    example: '今日、いい感じ。',
    speechProfileData: {
      endings: ['〜……', '〜……かな', '〜……だね'],
      frequentPhrases: ['うん', 'ありがと', 'そうだね'],
      avoidedPhrases: ['マジで', 'やべえ'],
      examples: ['今日、いい天気だね。', '……別に。', 'まぁ、そんな感じ。'],
    },
  },
  {
    legacyId: 'be34dad9-d3ef-8026-c127-4efe2c143f77',
    category: 'speech',
    label: 'ご婦人風',
    description: '華やかな柔らかい口調：「〜かしら」「あらやだ」など',
    example: '今日はいい感じね。',
    speechProfileData: {
      endings: ['〜かしら', '〜わね', '〜でしょう？'],
      frequentPhrases: ['どうかしら', '悪くないわね', 'こんな感じでしょう？'],
      avoidedPhrases: ['マジで', 'やべえ'],
      examples: ['今日はいい天気ね。', 'ご一緒にいかがかしら。', 'あなたもお好きでしょう？'],
    },
  },

  { legacyId: '24e3646f-fba5-86c9-cda0-963ce1766158', category: 'occupation', label: '高校生', description: null },
  { legacyId: '1afe306b-9017-790b-92bb-bcfce150d439', category: 'occupation', label: '大学生', description: null },
  { legacyId: 'a47ffb6f-d8c1-6a12-e1d4-b14196c9ba78', category: 'occupation', label: '会社員', description: null },
  { legacyId: '1a610372-2b36-a116-5243-3b288fb5245c', category: 'occupation', label: '公務員', description: null },

  { legacyId: '35a7ec73-c71f-c5ba-1bd4-a54dca65ded3', category: 'first_person', label: '私', description: null },
  { legacyId: '495accc0-5c67-6384-195a-415ef3b57654', category: 'first_person', label: '僕', description: null },
  { legacyId: '8c05e37e-5dd3-03a2-0b7f-d5c4c95f6126', category: 'first_person', label: '俺', description: null },
  { legacyId: '4562156a-3610-1318-3a66-d8098c1d6686', category: 'first_person', label: '自分', description: null },
];

const DEFAULT_PRESET_TEMPLATES = DEFAULT_PRESET_TEMPLATES_BASE.map((preset) => ({
  ...preset,
  example: preset.example ?? null,
  speechProfileData: preset.speechProfileData ?? null,
}));

const LEGACY_DEFAULT_PRESET_ID_SET = new Set(DEFAULT_PRESET_TEMPLATES.map((preset) => preset.legacyId));
const DEFAULT_TEMPLATE_BY_LEGACY_ID = new Map(DEFAULT_PRESET_TEMPLATES.map((preset) => [preset.legacyId, preset]));
const bootstrapInFlightByUserId = new Map<string, Promise<void>>();

function nowIso() {
  return new Date().toISOString();
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildBootstrapStorageKey(userId: string) {
  return `${BOOTSTRAP_STORAGE_PREFIX}:${userId}:v${DEFAULT_PRESETS_VERSION}`;
}

function hasBootstrapMarker(userId: string) {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(buildBootstrapStorageKey(userId)) === '1';
}

function setBootstrapMarker(userId: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(buildBootstrapStorageKey(userId), '1');
}

export function isLegacyDefaultPresetId(id?: string | null): id is string {
  return !!id && LEGACY_DEFAULT_PRESET_ID_SET.has(id);
}

async function resolveCurrentUserId(): Promise<string | null> {
  const sb = supabaseClient;
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) return null;
  return data?.session?.user?.id ?? null;
}

function createTemplateKey(category: PresetCategory, label: string) {
  return `${category}:${label}`;
}

function createGuestPreset(template: (typeof DEFAULT_PRESET_TEMPLATES)[number]): Preset {
  return {
    id: template.legacyId,
    category: template.category,
    label: template.label,
    description: template.description,
    example: template.example ?? null,
    speechProfileData: template.speechProfileData ?? null,
    isManaged: true,
    owner_id: 'SYSTEM',
    updated_at: nowIso(),
    deleted: false,
  };
}

function createUserOwnedPreset(
  template: (typeof DEFAULT_PRESET_TEMPLATES)[number],
  source?: Partial<Preset>,
): Preset {
  return {
    id: newId(),
    category: source?.category ?? template.category,
    label: source?.label ?? template.label,
    description: source?.description ?? template.description ?? null,
    example: source?.example ?? template.example ?? null,
    speechProfileData: source?.speechProfileData ?? template.speechProfileData ?? null,
    isManaged: source?.isManaged ?? true,
    owner_id: null,
    updated_at: nowIso(),
    deleted: false,
  };
}

function findUserOwnedPresetByTemplate(
  presets: Preset[],
  template: (typeof DEFAULT_PRESET_TEMPLATES)[number],
): Preset | undefined {
  return presets.find(
    (preset) =>
      !preset.deleted &&
      !isLegacyDefaultPresetId(preset.id) &&
      preset.category === template.category &&
      preset.label === template.label,
  );
}

async function runPresetBootstrap() {
  const allPresets = (await listLocal('presets')) as Preset[];
  const activePresets = allPresets.filter((preset) => !preset.deleted);
  const migratedIdByLegacyId = new Map<string, string>();

  for (const template of DEFAULT_PRESET_TEMPLATES) {
    const existingUserOwned = findUserOwnedPresetByTemplate(activePresets, template);
    if (existingUserOwned) {
      migratedIdByLegacyId.set(template.legacyId, existingUserOwned.id);
      continue;
    }

    const legacyPreset = activePresets.find((preset) => preset.id === template.legacyId);
    const created = createUserOwnedPreset(template, legacyPreset);
    await putLocal('presets', created);
    activePresets.push(created);
    migratedIdByLegacyId.set(template.legacyId, created.id);
  }

  const residents = (await listLocal('residents')) as Array<Record<string, any>>;
  for (const resident of residents) {
    const next = { ...resident };
    let changed = false;

    const speechPresetId =
      typeof resident.speechPreset === 'string'
        ? resident.speechPreset
        : typeof resident.speech_preset === 'string'
          ? resident.speech_preset
          : null;
    if (speechPresetId && migratedIdByLegacyId.has(speechPresetId)) {
      const mapped = migratedIdByLegacyId.get(speechPresetId)!;
      if (resident.speechPreset !== undefined || resident.speech_preset === undefined) {
        next.speechPreset = mapped;
      }
      if (resident.speech_preset !== undefined) {
        next.speech_preset = mapped;
      }
      changed = true;
    }

    const occupationId = typeof resident.occupation === 'string' ? resident.occupation : null;
    if (occupationId && migratedIdByLegacyId.has(occupationId)) {
      next.occupation = migratedIdByLegacyId.get(occupationId)!;
      changed = true;
    }

    const firstPersonId =
      typeof resident.firstPerson === 'string'
        ? resident.firstPerson
        : typeof resident.first_person === 'string'
          ? resident.first_person
          : null;
    if (firstPersonId && migratedIdByLegacyId.has(firstPersonId)) {
      const mapped = migratedIdByLegacyId.get(firstPersonId)!;
      if (resident.firstPerson !== undefined || resident.first_person === undefined) {
        next.firstPerson = mapped;
      }
      if (resident.first_person !== undefined) {
        next.first_person = mapped;
      }
      changed = true;
    }

    if (changed) {
      next.updated_at = nowIso();
      await putLocal('residents', next);
    }
  }

  for (const preset of allPresets) {
    if (!isLegacyDefaultPresetId(preset.id)) continue;
    await removeLocal('presets', preset.id);
  }
}

export async function ensureUserPresetBootstrap(userId: string) {
  if (!userId) return;

  const existingTask = bootstrapInFlightByUserId.get(userId);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    if (hasBootstrapMarker(userId)) return;
    await runPresetBootstrap();
    setBootstrapMarker(userId);
  })().finally(() => {
    bootstrapInFlightByUserId.delete(userId);
  });

  bootstrapInFlightByUserId.set(userId, task);
  await task;
}

async function ensureCurrentUserPresetBootstrap(): Promise<string | null> {
  const userId = await resolveCurrentUserId();
  if (!userId) return null;
  await ensureUserPresetBootstrap(userId);
  return userId;
}

/**
 * 互換用エクスポート（scripts/seed.ts から参照される）
 * 実運用のローカル保存IDとしては利用しない。
 */
export const DEFAULT_PRESETS: Preset[] = DEFAULT_PRESET_TEMPLATES.map((preset) => ({
  id: preset.legacyId,
  category: preset.category,
  label: preset.label,
  description: preset.description,
  example: preset.example ?? null,
  speechProfileData: preset.speechProfileData ?? null,
  isManaged: true,
  owner_id: null,
  updated_at: nowIso(),
  deleted: false,
}));

async function fetchPresets(): Promise<Preset[]> {
  const items = (await listLocal('presets')) as Preset[];
  return items.filter((item) => !item.deleted);
}

function mergeGuestPresets(localPresets: Preset[]): Preset[] {
  const merged = new Map<string, Preset>();

  for (const template of DEFAULT_PRESET_TEMPLATES) {
    const base = createGuestPreset(template);
    merged.set(createTemplateKey(base.category, base.label), base);
  }

  for (const item of localPresets) {
    const key = createTemplateKey(item.category, item.label);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        ...item,
        isManaged: item.isManaged ?? existing.isManaged ?? false,
        description: item.description ?? existing.description ?? null,
        example: item.example ?? existing.example ?? null,
        speechProfileData: item.speechProfileData ?? existing.speechProfileData ?? null,
      });
    } else {
      merged.set(key, {
        ...item,
        isManaged: item.isManaged ?? false,
        description: item.description ?? null,
        example: item.example ?? null,
        speechProfileData: item.speechProfileData ?? null,
      });
    }
  }

  return Array.from(merged.values());
}

async function fetchPresetsWithDefaults(): Promise<Preset[]> {
  const userId = await ensureCurrentUserPresetBootstrap();
  const localPresets = await fetchPresets();
  if (userId) return localPresets;
  return mergeGuestPresets(localPresets);
}

async function resolveLegacyPresetId(id: string): Promise<string | null> {
  if (!isLegacyDefaultPresetId(id)) return id;
  const template = DEFAULT_TEMPLATE_BY_LEGACY_ID.get(id);
  if (!template) return null;

  const localPresets = await fetchPresets();
  const mapped = localPresets.find(
    (preset) =>
      !isLegacyDefaultPresetId(preset.id) &&
      preset.category === template.category &&
      preset.label === template.label,
  );
  return mapped?.id ?? null;
}

export function usePresets() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchPresetsWithDefaults,
  });
}

export function usePresetsByCategory(category: PresetCategory) {
  return useQuery({
    queryKey: [...KEY, category],
    queryFn: async () => {
      const allPresets = await fetchPresetsWithDefaults();
      return allPresets.filter((preset) => preset.category === category);
    },
  });
}

export function useUpsertPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<Preset>) => {
      await ensureCurrentUserPresetBootstrap();

      const draft: Partial<Preset> = { ...input };
      let resolvedId: string | null = draft.id ?? null;

      if (resolvedId && isLegacyDefaultPresetId(resolvedId)) {
        resolvedId = await resolveLegacyPresetId(resolvedId);
      }

      let existing: Preset | undefined;
      if (resolvedId) {
        existing = (await getLocal('presets', resolvedId)) as Preset | undefined;
      }

      if (!draft.category || !draft.label) {
        if (existing) {
          draft.category = draft.category ?? existing.category;
          draft.label = draft.label ?? existing.label;
          draft.description = draft.description ?? existing.description ?? null;
          draft.example = draft.example ?? existing.example ?? null;
          draft.speechProfileData = draft.speechProfileData ?? existing.speechProfileData ?? null;
        } else if (input.id && isLegacyDefaultPresetId(input.id)) {
          const template = DEFAULT_TEMPLATE_BY_LEGACY_ID.get(input.id);
          if (template) {
            draft.category = draft.category ?? template.category;
            draft.label = draft.label ?? template.label;
            draft.description = draft.description ?? template.description ?? null;
            draft.example = draft.example ?? template.example ?? null;
            draft.speechProfileData = draft.speechProfileData ?? template.speechProfileData ?? null;
          }
        }
      }

      if (!draft.category || !draft.label) {
        throw new Error('Category and Label are required to upsert a preset.');
      }

      const record: Preset = {
        ...draft,
        id: resolvedId ?? newId(),
        category: draft.category,
        label: draft.label,
        isManaged: draft.isManaged ?? existing?.isManaged ?? false,
        description: draft.description ?? existing?.description ?? null,
        example: draft.example ?? existing?.example ?? null,
        speechProfileData:
          draft.speechProfileData !== undefined
            ? draft.speechProfileData
            : (existing?.speechProfileData ?? null),
        updated_at: nowIso(),
        deleted: false,
        owner_id: null,
      };

      await putLocal('presets', record);
      return record;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await ensureCurrentUserPresetBootstrap();

      const resolvedId = isLegacyDefaultPresetId(id) ? await resolveLegacyPresetId(id) : id;
      if (!resolvedId) return;
      await markDeleted('presets', resolvedId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

