import type { EventLogStrict } from '@repo/shared/types/conversation';

export function hasAnsweredConsultSelection(payload: unknown): boolean {
  const selectedChoiceId = (payload as { selectedChoiceId?: unknown } | null | undefined)?.selectedChoiceId;
  return typeof selectedChoiceId === 'string' && selectedChoiceId.length > 0;
}

export function isReportTargetEvent(event: EventLogStrict): boolean {
  if (!event) return false;
  if (event.kind === 'conversation') return true;
  if (event.kind === 'consult') return hasAnsweredConsultSelection((event as any)?.payload);
  return false;
}

export function filterReportTargetEvents(events: EventLogStrict[]): EventLogStrict[] {
  return events.filter(isReportTargetEvent);
}
