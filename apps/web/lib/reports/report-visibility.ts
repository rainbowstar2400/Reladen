import type { EventLogStrict } from '@repo/shared/types/conversation';

type ConsultSelectionSource = {
  selectedChoiceId?: unknown;
} | null | undefined;

export type ResolveConsultSelectedChoiceIdInput = {
  payload?: ConsultSelectionSource;
  serverAnswer?: ConsultSelectionSource;
  localAnswer?: ConsultSelectionSource;
};

function extractSelectedChoiceId(source: ConsultSelectionSource): string | null {
  if (!source || typeof source !== 'object') return null;
  const raw = source.selectedChoiceId;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveConsultSelectedChoiceId(
  input: ResolveConsultSelectedChoiceIdInput,
): string | null {
  return (
    extractSelectedChoiceId(input.payload)
    ?? extractSelectedChoiceId(input.serverAnswer)
    ?? extractSelectedChoiceId(input.localAnswer)
    ?? null
  );
}

export function hasAnsweredConsultSelection(payload: unknown): boolean {
  return resolveConsultSelectedChoiceId({ payload: payload as ConsultSelectionSource }) !== null;
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
