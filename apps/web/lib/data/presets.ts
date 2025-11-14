'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Preset as PresetType, PresetCategory as PresetCategoryType } from '@/types';
import { listLocal, putLocal, getLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';

export type Preset = PresetType;
export type PresetCategory = PresetCategoryType;

// デフォルトプリセットを定義
const now = new Date().toISOString();

const DEFAULT_PRESETS: Preset[] = [
    // Speech
    { id: 'default_speech_1', category: 'speech', label: 'ていねい', description: '常に敬語を使い、相手に敬意を払う。', isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: 'default_speech_3', category: 'speech', label: 'くだけた', description: '友人や家族と話すような、親しみやすい話し方。', isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },

    // Occupation
    { id: 'default_occupation_1', category: 'occupation', label: '高校生', description: null, isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: 'default_occupation_2', category: 'occupation', label: '会社員', description: null, isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: 'default_occupation_3', category: 'occupation', label: '公務員', description: null, isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },

    // First Person
    { id: 'default_first_person_1', category: 'first_person', label: '私（わたし）', description: null, isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: 'default_first_person_2', category: 'first_person', label: '僕（ぼく）', description: null, isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },
    { id: 'default_first_person_3', category: 'first_person', label: '俺（おれ）', description: null, isManaged: false, owner_id: 'SYSTEM', updated_at: now, deleted: false },
];


const KEY = ['presets'];

/**
 * ローカルDBからプリセットを取得する内部関数 (deleted=false のみ)
 */
async function fetchPresets(): Promise<Preset[]> {
    const items = (await listLocal('presets')) as Preset[];
    return items.filter((item) => !item.deleted);
}

/**
 * すべてのプリセットを取得する React Query フック (DBのみ)
 * (usePresetsByCategory がメインになるため、これは usePresetsDB にリネームしてもよい)
 */
export function usePresets() {
    return useQuery({
        queryKey: KEY,
        queryFn: fetchPresets,
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
            // 1. ローカルDBのデータを取得
            const localPresets = (await fetchPresets()).filter(p => p.category === category);

            // 2. このカテゴリのデフォルトデータを取得
            const categoryDefaults = DEFAULT_PRESETS.filter(p => p.category === category);

            // ラベルをキーにしてマージ処理
            const finalMap = new Map<string, Preset>();

            // 3. デフォルトを先に入れる (isManaged: false がデフォルト状態)
            for (const p of categoryDefaults) {
                finalMap.set(p.label, { ...p, isManaged: false });
            }

            // 4. ローカルデータで上書き
            for (const item of localPresets) {
                const existingDefault = finalMap.get(item.label);
                if (existingDefault) {
                    // デフォルトと同じラベル -> IDとisManagedをローカルのもので上書き
                    finalMap.set(item.label, { ...existingDefault, id: item.id, isManaged: item.isManaged });
                } else {
                    // ユーザーが追加したカスタムプリセット
                    finalMap.set(item.label, item);
                }
            }

            // Map の値を配列にして返す
            return Array.from(finalMap.values());
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
            if (isDefault && input.id) {
                // デフォルトデータを参照
                existing = DEFAULT_PRESETS.find(p => p.id === input.id);
                if (existing) {
                    // デフォルトデータから必須項目をコピー (input になければ)
                    input.category = input.category ?? existing.category;
                    input.label = input.label ?? existing.label;
                    input.description = input.description ?? existing.description;
                }
            } else if (input.id) {
                // 既存のローカルデータを取得
                existing = (await getLocal('presets', input.id)) as Preset | undefined;
            }

            if (!input.category || !input.label) {
                throw new Error('Category and Label are required to upsert a preset.');
            }

            const record: Preset = {
                // デフォルト値
                description: null,
                isManaged: false,
                // 既存の値 (デフォルト or ローカル)
                ...(existing ?? {}),
                // 入力値 (isManaged, label, description など)
                ...input,
                // 必須項目を確定
                id,
                category: input.category,
                label: input.label,
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