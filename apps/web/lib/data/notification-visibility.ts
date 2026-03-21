import type { NotificationRecord } from '@repo/shared/types/conversation';

export type ConsultPayloadLike = {
  expiresAt?: unknown;
  selectedChoiceId?: unknown;
};

function parseDateMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function hasSelectedChoiceId(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

export function filterNotificationsByRecency(
  notifications: NotificationRecord[],
  nowMs: number = Date.now(),
): NotificationRecord[] {
  return notifications.filter((notification) => {
    const occurredAt = Date.parse(notification.occurredAt);
    if (!Number.isFinite(occurredAt)) return true;
    const diffHours = (nowMs - occurredAt) / (1000 * 60 * 60);

    if (notification.status === 'read') return diffHours < 5;
    if (notification.status === 'unread') return diffHours < 10;
    return true;
  });
}

export function isExpiredUnansweredConsultPayload(
  payload: ConsultPayloadLike | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!payload) return false;
  if (hasSelectedChoiceId(payload.selectedChoiceId)) return false;
  const expiresAtMs = parseDateMs(payload.expiresAt);
  if (expiresAtMs === null) return false;
  return expiresAtMs < nowMs;
}

export function filterExpiredUnansweredConsultNotifications(
  notifications: NotificationRecord[],
  consultPayloadByEventId: Map<string, ConsultPayloadLike>,
  nowMs: number = Date.now(),
): NotificationRecord[] {
  return notifications.filter((notification) => {
    if (notification.type !== 'consult') return true;
    const payload = consultPayloadByEventId.get(notification.linkedEventId);
    if (!payload) return true;
    return !isExpiredUnansweredConsultPayload(payload, nowMs);
  });
}
