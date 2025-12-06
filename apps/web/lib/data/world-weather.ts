import { listLocal, putLocal, removeLocal } from '@/lib/db-local';
import type { Resident, WorldStateRecord, WorldWeatherState } from '@/types';
import { calcQuietHoursForWorld, createInitialWeatherState } from '@repo/shared/logic/weather';

export const DEFAULT_WORLD_ID = '00000000-0000-4000-8000-000000000000';
const LEGACY_WORLD_IDS = ['default-world'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  // migrate legacy non-UUID world IDs to the current UUID so sync passes validation
  if (!items.some((w) => w.id === DEFAULT_WORLD_ID)) {
    const legacy = items.find((w) => LEGACY_WORLD_IDS.includes(w.id) || !UUID_REGEX.test(w.id));
    if (legacy) {
      const migrated: WorldStateRecord = {
        ...legacy,
        id: DEFAULT_WORLD_ID,
        updated_at: new Date().toISOString(),
      };
      try {
        await removeLocal('world_states', legacy.id);
      } catch (e) {
        console.warn('[loadWorldWeather] failed to remove legacy world id', e);
      }
      await putLocal('world_states', migrated as any);
      items.push(migrated);
    }
  }

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
