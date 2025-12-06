// apps/web/components/providers/WeatherSchedulerProvider.tsx
"use client";

import { useEffect, useRef } from "react";
import { startWeatherScheduler } from "@/lib/scheduler/weather-scheduler";
import { useAuth } from "@/lib/auth/use-auth";

type Props = {
  enabled?: boolean;
  baseIntervalMs?: number;
  children?: React.ReactNode;
};

export default function WeatherSchedulerProvider(props: Props) {
  const {
    enabled = process.env.NEXT_PUBLIC_WEATHER_SCHEDULER !== "off",
    baseIntervalMs = 60 * 60 * 1000,
    children,
  } = props;

  const stopRef = useRef<null | { stop: () => void }>(null);
  const { user, ready } = useAuth();
  const shouldRun = Boolean(enabled && ready && user);

  useEffect(() => {
    stopRef.current?.stop?.();
    stopRef.current = null;

    if (!shouldRun) return;

    stopRef.current = startWeatherScheduler({ baseIntervalMs, enabled: true });

    return () => {
      stopRef.current?.stop?.();
      stopRef.current = null;
    };
  }, [shouldRun, baseIntervalMs]);

  return <>{children}</>;
}
