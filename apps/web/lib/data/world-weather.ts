import { listLocal, putLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import type { Resident, WorldStateRecord, WorldWeatherState } from '@/types';
import { calcQuietHoursForWorld, createInitialWeatherState } from '@repo/shared/logic/weather';

export const DEFAULT_WORLD_ID = 'default-world';

function toRich(record: WorldStateRecord): WorldStateRecord & WorldWeatherState {
  return {
    ...record,
    current: record.weatherCurrent,
    quietHours: record.weatherQuietHours,
    currentComment: record.weatherComment,
  };
}

function fromRich(world: WorldStateRecord & WorldWeatherState): WorldStateRecord {
  return {
    id: world.id,
    owner_id: world.owner_id,
    deleted: world.deleted,
    updated_at: world.updated_at,
    weatherCurrent: world.current,
    weatherQuietHours: world.quietHours,
    weatherComment: world.currentComment,
  };
}

export async function loadWorldWeather(worldId: string = DEFAULT_WORLD_ID): Promise<WorldStateRecord & WorldWeatherState> {
  const items = (await listLocal<WorldStateRecord>('world_states')) ?? [];
  const found = items.find((w) => w.id === worldId);
  if (found) return toRich(found);

  const now = new Date().toISOString();
  const base = createInitialWeatherState();
  const fresh: WorldStateRecord & WorldWeatherState = {
    id: worldId,
    updated_at: now,
    deleted: false,
    owner_id: null,
    ...base,
    weatherCurrent: base.current,
    weatherQuietHours: base.quietHours,
    weatherComment: base.currentComment,
  };
  await putLocal('world_states', fromRich(fresh) as any);
  return fresh;
}

export async function saveWorldWeather(world: WorldStateRecord & WorldWeatherState) {
  const updated = {
    ...world,
    updated_at: new Date().toISOString(),
    deleted: world.deleted ?? false,
  };
  await putLocal('world_states', fromRich(updated) as any);
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
