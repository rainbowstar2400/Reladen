'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Preset as PresetType, PresetCategory as PresetCategoryType } from '@/types';
import { listLocal, putLocal, getLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';

export type Preset = PresetType;
export type PresetCategory = PresetCategoryType;

// デフォルトプリセットを定義
const now = new Date().toISOString();

type DefaultPresetInput = Omit<Preset, 'example'> & { example?: string | null };

const DEFAULT_PRESETS_BASE: ReadonlyArray<DefaultPresetInput> = [
    // Speech
    { id: 'fdc5f580-a7c6-dbb1-28f6-64ad237831aa', category: 'speech', label: '優しい敬語', description: '丁寧で穏やかな話し方：「〜です」「〜ます」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日はいい感じですね。' },
    { id: '33ff24b3-0861-6bc0-7aa0-4ac350fe5c51', category: 'speech', label: '冷たい敬語', description: '距離感のある敬語：「ご自由にどうぞ」「そうですか」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日、いい感じですね。' },
    { id: 'a24b66df-0f96-e060-26ee-6e153dd14754', category: 'speech', label: 'タメ口', description: 'フレンドリーな砕けた口調：「〜だよ」「〜じゃん」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日いい感じじゃん。' },
    { id: '7d4ffa4f-e0cb-19d2-85f1-27ff467cef0a', category: 'speech', label: 'ギャル語', description: '砕けた陽気な話し方：「マジで？」「〜じゃね？」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日、いい感じじゃね？' },
    { id: 'd4498811-d12f-a38a-7eec-474dc908b26f', category: 'speech', label: 'お嬢様風', description: '上品で古風な敬語：「〜ですわ」「〜ですこと」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日はいい感じですわね。' },
    { id: '5d603d72-66c7-90d8-9259-5c804e412bdc', category: 'speech', label: '関西弁', description: '柔らかい関西口調：「〜やで」「ほんま？」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日いい感じやね。' },
    { id: 'b3ff700f-489a-f3b3-c491-f115c00536b4', category: 'speech', label: '子供っぽい', description: '幼い印象の話し方：「〜だね！」「やったぁ」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日はいい感じだね！' },
    { id: 'd58d88d7-abb1-90bc-d6d3-0d1723c67349', category: 'speech', label: '無口', description: '短く省略がち：「……別に」「うん」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日、いい感じ。' },
    { id: 'be34dad9-d3ef-8026-c127-4efe2c143f77', category: 'speech', label: 'ご婦人風', description: '華やかな柔らかい口調：「〜かしら」「あらやだ」など', isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false, example: '今日はいい感じね。' },

    // Occupation
    { id: '24e3646f-fba5-86c9-cda0-963ce1766158', category: 'occupation', label: '高校生', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: '1afe306b-9017-790b-92bb-bcfce150d439', category: 'occupation', label: '大学生', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: 'a47ffb6f-d8c1-6a12-e1d4-b14196c9ba78', category: 'occupation', label: '会社員', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: '1a610372-2b36-a116-5243-3b288fb5245c', category: 'occupation', label: '公務員', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },

    // First Person
    { id: '35a7ec73-c71f-c5ba-1bd4-a54dca65ded3', category: 'first_person', label: '私', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: '495accc0-5c67-6384-195a-415ef3b57654', category: 'first_person', label: '僕', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: '8c05e37e-5dd3-03a2-0b7f-d5c4c95f6126', category: 'first_person', label: '俺', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: '4562156a-3610-1318-3a66-d8098c1d6686', category: 'first_person', label: '自分', description: null, isManaged: true, owner_id: 'SYSTEM', updated_at: now, deleted: false },
];

export const DEFAULT_PRESETS: Preset[] = DEFAULT_PRESETS_BASE.map((preset) => ({
    ...preset,
    example: preset.example ?? null,
    isManaged: preset.isManaged ?? false,
}));


const KEY = ['presets'];

/**
 * ローカルDBからプリセットを取得する内部関数 (deleted=false のみ)
 */
async function fetchPresets(): Promise<Preset[]> {
    const items = (await listLocal('presets')) as Preset[];
    return items.filter((item) => !item.deleted);
}

// デフォルトとローカルをマージする内部関数
async function fetchPresetsWithDefaults(): Promise<Preset[]> {
    // 1. ローカルDBのデータを取得
    const localPresets = await fetchPresets(); // (deleted=false のみ)

    // 2. すべてのデフォルトデータを取得
    const categoryDefaults = DEFAULT_PRESETS;

    // ラベルをキーにしてマージ処理
    const finalMap = new Map<string, Preset>();

    // 3. デフォルトを先に入れる (isManaged: true がデフォルト状態)
    for (const p of categoryDefaults) {
        finalMap.set(p.label, { ...p, isManaged: true });
    }

    // 4. ローカルデータで上書き
    for (const item of localPresets) {
        const existingDefault = finalMap.get(item.label);
        if (existingDefault) {
            // デフォルトと同じラベル -> ID, isManaged, owner_id などをローカルのもので上書き
            finalMap.set(item.label, {
                ...existingDefault,
                ...item,
                isManaged: item.isManaged ?? existingDefault.isManaged ?? false,
                description: item.description ?? existingDefault.description ?? null,
                example: item.example ?? existingDefault.example ?? null,
            });
        } else {
            // ユーザーが追加したカスタムプリセット
            finalMap.set(item.label, {
                ...item,
                isManaged: item.isManaged ?? false,
                description: item.description ?? null,
                example: item.example ?? null,
            });
        }
    }

    // Map の値を配列にして返す
    return Array.from(finalMap.values());
}

/**
 * すべてのプリセットを取得する React Query フック (デフォルトとマージ)
*/
export function usePresets() {
    return useQuery({
        queryKey: KEY,
        queryFn: fetchPresetsWithDefaults,
    });
}

/**
 * カテゴリ別にフィルタリングして取得するフック (デフォルトとマージ)
 * @param category 'speech' | 'occupation' | 'first_person'
 */
export function usePresetsByCategory(category: PresetCategory) {
    return useQuery({
        queryKey: [...KEY, category],
        queryFn: async () => {
            // fetchPresetsWithDefaults を呼び、カテゴリで絞り込む
            const allPresets = await fetchPresetsWithDefaults();
            return allPresets.filter(p => p.category === category);
        },
    });
}

/**
 * プリセットを追加・更新する React Query フック
 */
export function useUpsertPreset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: Partial<Preset>) => {

            // デフォルトプリセットのID (default_*) が来た場合、ローカルDB用の新しいID (newId()) に切り替える
            const isDefault = input.id?.startsWith('default_');
            const id = isDefault || !input.id ? newId() : input.id;

            let existing: Preset | undefined;

            const skipGetLocal = input.category && input.label;

            if (isDefault && input.id) {
                // デフォルトデータを参照
                existing = DEFAULT_PRESETS.find(p => p.id === input.id);
                if (existing) {
                    // デフォルトデータから必須項目をコピー (input になければ)
                    input.category = input.category ?? existing.category;
                    input.label = input.label ?? existing.label;
                    input.description = input.description ?? existing.description;
                    input.example = input.example ?? existing.example;
                }
            } else if (input.id && !skipGetLocal) {
                // (Switch操作では呼ばれなくなる)
                existing = (await getLocal('presets', input.id)) as Preset | undefined;
            }

            if (!input.category || !input.label) {
                throw new Error('Category and Label are required to upsert a preset.');
            }

            const record: Preset = {
                // 入力値 (isManaged, label, description など)
                ...input,
                // 必須項目を確定
                id,
                category: input.category,
                label: input.label,
                isManaged: input.isManaged ?? existing?.isManaged ?? false,
                description: input.description ?? existing?.description ?? null,
                example: input.example ?? existing?.example ?? null,
                updated_at: new Date().toISOString(),
                deleted: false,
                owner_id: existing?.owner_id === 'SYSTEM' ? null : (existing?.owner_id ?? null), // SYSTEM ID は引き継がない
            };

            await putLocal('presets', record);
            return record;
        },
        onSuccess: () => {
            // プリセットキャッシュを無効化し、関連するクエリを再取得
            void queryClient.invalidateQueries({ queryKey: KEY });
        },
    });
}

/**
 * プリセットを削除（論理削除）する React Query フック
 */
export function useDeletePreset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            if (id.startsWith('default_')) {
                console.warn('Cannot delete default preset, setting isManaged=false instead.');
                // 代わりに isManaged: false にする (useUpsertPreset を呼ぶべきだが、ここでは何もしない)
                // (UI側で isManaged: false になっているはず)
                return;
            }
            await markDeleted('presets', id);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: KEY });
        },
    });
}


