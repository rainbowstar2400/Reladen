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

export function normalizePulledRow(
  table: SyncPayload['table'],
  row: Record<string, any>,
): Record<string, any> {
  return addSnakeCamelAliases(row);
}

