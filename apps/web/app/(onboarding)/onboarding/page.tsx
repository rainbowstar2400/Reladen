'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile, useUpsertPlayerProfile } from '@/lib/data/player-profile';
import { StepIndicator } from '@/components/onboarding/step-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Onboarding steps (pre-login only — resident registration happens in dashboard):
 * 0 - Selection: "新規で開始" / "ログインして続ける"
 * 1 - Privacy policy acceptance (new game path only)
 * 2 - Google Login (new game path; returning users login at step 0)
 * 3 - Player name input → redirect to /home (tutorial mode)
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { ready, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = usePlayerProfile();
  const upsertProfile = useUpsertPlayerProfile();

  const [step, setStep] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Whether user chose "新規で開始" (affects step flow)
  const [isNewGame, setIsNewGame] = useState(false);

  // Determine initial step based on existing state
  useEffect(() => {
    if (!ready || profileLoading) return;

    // Already completed → go home (layout also guards, but belt-and-suspenders)
    if (profile?.onboarding_completed) {
      router.replace('/home');
      return;
    }

    if (!user) {
      // Not logged in → show selection screen (step 0)
      // But if isNewGame was already set (user clicked "新規で開始"), stay on current step
      if (!isNewGame) setStep(0);
      return;
    }

    // Logged in — determine which step to resume from
    if (!profile?.privacy_accepted_at) {
      // Need privacy acceptance. If they came via "ログインして続ける" (existing user),
      // they should have a profile already. If not, treat as new game.
      setIsNewGame(true);
      setStep(1);
    } else if (!profile?.player_name || profile.player_name === '_pending') {
      setStep(3);
    } else {
      // Name set → go to dashboard (tutorial mode handles resident registration)
      router.replace('/home');
    }
  }, [ready, user, profile, profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = useCallback(async () => {
    const { supabaseClient } = await import('@/lib/db-cloud/supabase');
    if (!supabaseClient) return;
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined'
          ? window.location.origin + '/onboarding'
          : undefined,
      },
    });
  }, []);

  const handleNewGame = useCallback(() => {
    setIsNewGame(true);
    setStep(1); // → Privacy policy
  }, []);

  const handleLoginContinue = useCallback(() => {
    // Existing user: go straight to Google login
    void handleSignIn();
  }, [handleSignIn]);

  const handleAcceptPrivacy = useCallback(async () => {
    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync({
        player_name: '_pending',
        privacy_accepted_at: new Date().toISOString(),
      });
      setStep(2); // → Google login
    } finally {
      setSubmitting(false);
    }
  }, [upsertProfile]);

  const handleSubmitName = useCallback(async () => {
    if (!playerName.trim()) return;
    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync({
        player_name: playerName.trim(),
      });
      // Name set → dashboard will show tutorial mode
      router.push('/home');
    } finally {
      setSubmitting(false);
    }
  }, [upsertProfile, playerName, router]);

  // Loading state
  if (!ready || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/40 text-sm animate-pulse">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white/90">
          Reladen
        </h1>
        <p className="text-sm text-white/50">
          住人たちの暮らす世界をつくりましょう
        </p>
      </div>

      {step > 0 && <StepIndicator current={step} />}

      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 backdrop-blur-sm">
        {/* Step 0: Selection */}
        {step === 0 && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-white/70 text-center text-sm">
              はじめまして、あるいはお帰りなさい。
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={handleNewGame} size="lg" className="w-full">
                新規で開始
              </Button>
              <Button
                onClick={handleLoginContinue}
                variant="outline"
                size="lg"
                className="w-full border-white/20 text-white/80 hover:bg-white/10"
              >
                ログインして続ける
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Privacy Policy (new game path) */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/15 bg-white/5 p-4 max-h-[40vh] overflow-y-auto text-sm text-white/70 space-y-3">
              <h2 className="text-base font-semibold text-white/80">プライバシーポリシー</h2>
              <p>
                Reladenでは、ゲーム体験の提供のために以下の情報を利用します。
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Googleアカウント情報（ログイン・データ同期のため）</li>
                <li>あなたが入力する住人情報・関係性データ</li>
                <li>会話生成のためにOpenAI APIへのデータ送信</li>
              </ul>
              <p>
                データはお使いの端末（IndexedDB）とクラウド（Supabase）に保存されます。
                詳細は設定画面の「プライバシーポリシー」からいつでも確認できます。
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={handleAcceptPrivacy}
                disabled={submitting}
                size="lg"
              >
                {submitting ? '保存中...' : '同意して次へ'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Google Login (new game path, after privacy) */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-white/70 text-center text-sm">
              Googleアカウントでログインしてください。
            </p>
            <Button onClick={handleSignIn} size="lg">
              Googleでログイン
            </Button>
          </div>
        )}

        {/* Step 3: Player Name */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-6">
            <div className="text-center space-y-2">
              <p className="text-white/70 text-sm">
                あなたの名前を教えてください。
              </p>
              <p className="text-xs text-white/50">
                住人たちがあなたをこの名前で呼びます。あとから変更もできます。
              </p>
            </div>
            <div className="w-full max-w-xs space-y-4">
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="プレイヤー名"
                maxLength={20}
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmitName();
                }}
              />
              <Button
                onClick={handleSubmitName}
                disabled={!playerName.trim() || submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? '保存中...' : 'はじめる'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
