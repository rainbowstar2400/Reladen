// apps/web/components/providers/ConversationSchedulerProvider.tsx
"use client";

import { useEffect, useRef } from "react";
import { startConversationScheduler } from "@/lib/scheduler/conversation-scheduler";
import { useAuth } from "@/lib/auth/use-auth";

type Props = {
  enabled?: boolean;
  baseIntervalMs?: number;
  defaultParticipants?: [string, string];
  children?: React.ReactNode;
};

export default function ConversationSchedulerProvider(props: Props) {
  const {
    enabled = process.env.NEXT_PUBLIC_CONV_SCHEDULER !== "off",
    baseIntervalMs = Number(process.env.NEXT_PUBLIC_CONV_SCHEDULER_INTERVAL ?? 90000),
    defaultParticipants = ["resident_A", "resident_B"],
    children,
  } = props;

  const stopRef = useRef<null | { stop: () => void }>(null);
  const { user, ready } = useAuth();
  const shouldRunScheduler = Boolean(enabled && ready && user);

  useEffect(() => {
    // 既存のスケジューラがあれば停止
    stopRef.current?.stop?.();
    stopRef.current = null;

    if (!shouldRunScheduler) {
      if (enabled && ready && !user) {
        console.info("[ConversationScheduler] スキップ: 未ログインのため会話生成を停止しています。");
      }
      return () => {
        stopRef.current?.stop?.();
      };
    }

    stopRef.current = startConversationScheduler({
      enabled: true,
      baseIntervalMs,
      defaultParticipants,
    });

    return () => {
      stopRef.current?.stop?.();
      stopRef.current = null;
    };
  }, [shouldRunScheduler, baseIntervalMs, defaultParticipants?.[0], defaultParticipants?.[1]]);

  return <>{children}</>;
}
