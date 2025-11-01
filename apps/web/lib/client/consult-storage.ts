// apps/web/lib/client/consult-storage.ts
// ブラウザの localStorage を使った簡易な回答保持。
// 後で DB に差し替えるときは、このファイルの load/save を置き換えるだけで UI 側は不変。

const KEY = (id: string) => `consult:${id}`

export type StoredConsultAnswer = {
  id: string
  selectedChoiceId: string
  decidedAt: string // ISO
}

export function loadConsultAnswer(id: string): StoredConsultAnswer | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY(id))
    return raw ? (JSON.parse(raw) as StoredConsultAnswer) : null
  } catch {
    return null
  }
}

export function saveConsultAnswer(id: string, selectedChoiceId: string) {
  if (typeof window === 'undefined') return
  const payload: StoredConsultAnswer = {
    id,
    selectedChoiceId,
    decidedAt: new Date().toISOString(),
  }
  localStorage.setItem(KEY(id), JSON.stringify(payload))
}
