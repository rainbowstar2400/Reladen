/**
 * プレログイン時のオンボーディング進捗を localStorage に保持する。
 * ログイン後に player_profiles へ転記し、クリアする。
 */

const PREFIX = 'reladen_onboarding_';

export function getOnboardingStep(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(PREFIX + 'step') ?? '0');
}

export function setOnboardingStep(step: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFIX + 'step', String(step));
}

export function getPrivacyAcceptedAt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PREFIX + 'privacy_accepted_at');
}

export function setPrivacyAcceptedAt(iso: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFIX + 'privacy_accepted_at', iso);
}

export function clearOnboardingStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PREFIX + 'step');
  localStorage.removeItem(PREFIX + 'privacy_accepted_at');
}
