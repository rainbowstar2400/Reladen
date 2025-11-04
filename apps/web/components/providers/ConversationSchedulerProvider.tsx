// apps/web/components/providers/ConversationSchedulerProvider.tsx
"use client";

import { useEffect, useRef } from "react";
import { startConversationScheduler } from "@/lib/scheduler/conversation-scheduler";

type Props = {
  enabled?: boolean;
  baseIntervalMs?: number;
  quietHours?: [number, number];
  defaultParticipants?: [string, string];
  children?: React.ReactNode;
};

export default function ConversationSchedulerProvider(props: Props) {
  const {
    enabled = process.env.NEXT_PUBLIC_CONV_SCHEDULER !== "off",
    baseIntervalMs = Number(process.env.NEXT_PUBLIC_CONV_SCHEDULER_INTERVAL ?? 90000),
    quietHours = [1, 6],
    defaultParticipants = ["resident_A", "resident_B"],
    children,
  } = props;

  const stopRef = useRef<null | { stop: () => void }>(null);

  useEffect(() => {
    // マウント時に開始
    stopRef.current = startConversationScheduler({
      enabled,
      baseIntervalMs,
      quietHours,
      defaultParticipants,
    });
    return () => {
      // アンマウント時に停止
      stopRef.current?.stop?.();
    };
  }, [enabled, baseIntervalMs, quietHours?.[0], quietHours?.[1], defaultParticipants?.[0], defaultParticipants?.[1]]);

  return <>{children}</>;
}
