import { useQuery } from '@tanstack/react-query';
import { DEFAULT_WORLD_ID, loadWorldWeather } from './world-weather';
import type { WorldStateRecord, WorldWeatherState } from '@/types';

export function useWorldWeather(worldId: string = DEFAULT_WORLD_ID) {
  return useQuery<WorldStateRecord & WorldWeatherState>({
    queryKey: ['world_weather', worldId],
    queryFn: () => loadWorldWeather(worldId),
  });
}
