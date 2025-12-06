import { listLocal, putLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import type { Resident, WorldStateRecord, WorldWeatherState } from '@/types';
import { calcQuietHoursForWorld, createInitialWeatherState } from '@repo/shared/logic/weather';

export const DEFAULT_WORLD_ID = 'default-world';

export async function loadWorldWeather(worldId: string = DEFAULT_WORLD_ID): Promise<WorldStateRecord> {
  const items = (await listLocal<WorldStateRecord>('world_states')) ?? [];
  const found = items.find((w) => w.id === worldId);
  if (found) return found;

  const now = new Date().toISOString();
  const fresh: WorldStateRecord = {
    id: worldId,
    updated_at: now,
    deleted: false,
    ...createInitialWeatherState(),
  };
  await putLocal('world_states', fresh as any);
  return fresh;
}

export async function saveWorldWeather(world: WorldStateRecord) {
  const updated = { ...world, updated_at: new Date().toISOString(), deleted: world.deleted ?? false };
  await putLocal('world_states', updated as any);
  return updated;
}

export function ensureQuietHours(
  state: WorldWeatherState,
  residents: Resident[],
): WorldWeatherState {
  const quiet = calcQuietHoursForWorld(residents);
  if (!quiet) return state;
  return { ...state, quietHours: quiet };
}
