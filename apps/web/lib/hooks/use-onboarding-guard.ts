'use client';

import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile } from '@/lib/data/player-profile';

/**
 * Returns whether the current user still needs onboarding.
 * Used by dashboard layout to determine curtain visibility (not for routing).
 * - Anonymous (no login) → needsOnboarding: true
 * - Logged in + onboarding not completed → needsOnboarding: true
 * - Completed → false
 */
export function useOnboardingGuard(): { loading: boolean; needsOnboarding: boolean } {
  const { ready, user } = useAuth();
  const { data: profile, isLoading } = usePlayerProfile();

  if (!ready || isLoading) {
    return { loading: true, needsOnboarding: false };
  }

  // Not logged in → onboarding required
  if (!user) {
    return { loading: false, needsOnboarding: true };
  }

  // Logged in but pre-login onboarding steps incomplete
  if (
    !profile ||
    !profile.privacy_accepted_at ||
    !profile.player_name ||
    profile.player_name === '_pending'
  ) {
    return { loading: false, needsOnboarding: true };
  }

  // Name set → stay in dashboard (tutorial mode handles the rest)
  return { loading: false, needsOnboarding: false };
}
