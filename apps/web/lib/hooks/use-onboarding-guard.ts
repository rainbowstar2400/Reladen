'use client';

import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile } from '@/lib/data/player-profile';

/**
 * Returns whether the current user still needs onboarding.
 * - Anonymous users (no login) → needsOnboarding: false (allow browsing)
 * - Logged in + no profile or onboarding_completed=false → needsOnboarding: true
 */
export function useOnboardingGuard(): { loading: boolean; needsOnboarding: boolean } {
  const { ready, user } = useAuth();
  const { data: profile, isLoading } = usePlayerProfile();

  if (!ready || isLoading) {
    return { loading: true, needsOnboarding: false };
  }

  // Not logged in — don't redirect (anonymous mode)
  if (!user) {
    return { loading: false, needsOnboarding: false };
  }

  // Logged in but no profile or onboarding not completed
  const needsOnboarding = !profile || !profile.onboarding_completed;
  return { loading: false, needsOnboarding };
}
