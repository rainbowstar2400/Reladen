'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// ★ 1. @/types からインポート (型のみ)
import type { Preset as PresetType, PresetCategory as PresetCategoryType } from '@/types';
import { listLocal, putLocal, getLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';

// ★ 2. インポートした型を 'export type' で再エクスポート
export type Preset = PresetType;
export type PresetCategory = PresetCategoryType;


const KEY = ['presets'];

/**
 * ローカルDBからプリセットを取得する内部関数 (deleted=false のみ)
 */
async function fetchPresets(): Promise<Preset[]> { // <--- Preset を使用
    // listLocal は Entity[] を返すため、Preset[] にキャスト
    const items = (await listLocal('presets')) as Preset[];
    return items.filter((item) => !item.deleted);
}

/**
 * すべてのプリセットを取得する React Query フック
 */
export function usePresets() {
    return useQuery({
        queryKey: KEY,
        queryFn: fetchPresets,
    });
}

/**
 * カテゴリ別にフィルタリングして取得するフック (オプション)
 * @param category 'speech' | 'occupation' | 'first_person'
 */
export function usePresetsByCategory(category: PresetCategory) { // <--- PresetCategory を使用
    return useQuery({
        queryKey: [...KEY, category],
        queryFn: async () =>
            (await fetchPresets()).filter((p) => p.category === category),
    });
}

/**
 * プリセットを追加・更新する React Query フック
 */
export function useUpsertPreset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: Partial<Preset>) => { // <--- Preset を使用
            if (!input.category || !input.label) {
                throw new Error('Category and Label are required to upsert a preset.');
            }
            const id = input.id ?? newId();

            // 既存データを取得してマージする（putLocalが全上書きのため）
            const existing = (await getLocal('presets', id)) as Preset | undefined; // <--- Preset を使用

            const record: Preset = { // <--- Preset を使用
                // 既存の値（デフォルト）
                description: null,
                isManaged: false,
                owner_id: null, // (c08dでの修正を反映)
                // 既存の値を上書き
                ...(existing ?? {}),
                // 入力値を最優先
                ...input,
                // 必須項目を確定
                id,
                category: input.category,
                label: input.label,
                updated_at: new Date().toISOString(),
                deleted: false,
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
            await markDeleted('presets', id);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: KEY });
        },
    });
}