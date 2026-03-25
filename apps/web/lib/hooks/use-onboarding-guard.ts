'use client';

import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile } from '@/lib/data/player-profile';

/**
 * Returns whether the current user still needs onboarding.
 * - Anonymous (no login) → needsOnboarding: true (must go to /onboarding)
 * - Logged in + no profile / no privacy / no name → needsOnboarding: true
 * - Logged in + name set (onboarding may be incomplete but tutorial continues in dashboard) → false
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
