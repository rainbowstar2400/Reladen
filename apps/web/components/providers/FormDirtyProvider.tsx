'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

type FormDirtyContextType = {
    isDirty: boolean;
    setIsDirty: (isDirty: boolean) => void;
};

const FormDirtyContext = createContext<FormDirtyContextType | undefined>(undefined);

/**
 * フォームの編集中状態 (isDirty) をグローバルに提供するプロバイダー
 */
export function FormDirtyProvider({ children }: { children: React.ReactNode }) {
    const [isDirty, setIsDirty] = useState(false);

    // setIsDirty を useCallback でメモ化
    const handleSetIsDirty = useCallback((dirty: boolean) => {
        setIsDirty(dirty);
    }, []);

    const value = useMemo(() => ({
        isDirty,
        setIsDirty: handleSetIsDirty
    }), [isDirty, handleSetIsDirty]);

    return (
        <FormDirtyContext.Provider value={value}>
            {children}
        </FormDirtyContext.Provider>
    );
}

/**
 * グローバルなフォーム編集中状態 (isDirty) とそのセッターを取得するフック
 */
export function useFormDirty() {
    const context = useContext(FormDirtyContext);
    if (context === undefined) {
        throw new Error('useFormDirty must be used within a FormDirtyProvider');
    }
    return context;
}