"use client";

import { useEffect, useRef } from "react";
import { startDailyScheduler } from "@/lib/scheduler/daily-scheduler";
import { useAuth } from "@/lib/auth/use-auth";

type Props = {
  enabled?: boolean;
  children?: React.ReactNode;
};

export default function DailyDecaySchedulerProvider(props: Props) {
  const {
    enabled = process.env.NEXT_PUBLIC_DAILY_DECAY_SCHEDULER !== "off",
    children,
  } = props;

  const stopRef = useRef<null | { stop: () => void }>(null);
  const { user, ready } = useAuth();
  const shouldRun = Boolean(enabled && ready && user);

  useEffect(() => {
    stopRef.current?.stop?.();
    stopRef.current = null;

    if (!shouldRun) return;

    stopRef.current = startDailyScheduler({ enabled: true });

    return () => {
      stopRef.current?.stop?.();
      stopRef.current = null;
    };
  }, [shouldRun]);

  return <>{children}</>;
}
