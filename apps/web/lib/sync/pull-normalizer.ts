import type { SyncPayload } from '@/types';

function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function addSnakeCamelAliases(input: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...input };

  for (const [key, value] of Object.entries(input)) {
    if (!key.includes('_')) continue;
    const camel = toCamelCase(key);
    if (!(camel in normalized)) {
      normalized[camel] = value;
    }
  }

  return normalized;
}

function normalizeConsultAnswerAliases(input: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...input };
  const selectedChoiceId =
    normalized.selectedChoiceId
    ?? normalized.selected_choice_id
    ?? normalized.selectedchoiceid
    ?? null;
  const decidedAt =
    normalized.decidedAt
    ?? normalized.decided_at
    ?? normalized.decidedat
    ?? null;

  normalized.selectedChoiceId = selectedChoiceId;
  normalized.selected_choice_id = selectedChoiceId;
  normalized.selectedchoiceid = selectedChoiceId;
  normalized.decidedAt = decidedAt;
  normalized.decided_at = decidedAt;
  normalized.decidedat = decidedAt;

  return normalized;
}

export function normalizePulledRow(
  table: SyncPayload['table'],
  row: Record<string, any>,
): Record<string, any> {
  const normalized = addSnakeCamelAliases(row);
  if (table !== 'consult_answers') return normalized;
  return normalizeConsultAnswerAliases(normalized);
}

