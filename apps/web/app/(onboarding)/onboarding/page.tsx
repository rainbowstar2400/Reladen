'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile, useUpsertPlayerProfile } from '@/lib/data/player-profile';
import { useResidents } from '@/lib/data/residents';
import { ResidentForm } from '@/components/forms/resident-form';
import { StepIndicator } from '@/components/onboarding/step-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { triggerConversationNow } from '@/lib/scheduler/conversation-scheduler';

/**
 * Steps:
 * 0 - Login (Google OAuth)
 * 1 - Privacy policy acceptance
 * 2 - Player name input
 * 3 - Register resident 1
 * 4 - Register resident 2 → complete → /home
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { ready, user, signInWithGoogle } = useAuth();
  const { data: profile, isLoading: profileLoading } = usePlayerProfile();
  const { data: residents } = useResidents();
  const upsertProfile = useUpsertPlayerProfile();

  const [step, setStep] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Determine initial step based on existing state
  useEffect(() => {
    if (!ready || profileLoading) return;

    // Already completed → go home
    if (profile?.onboarding_completed) {
      router.replace('/home');
      return;
    }

    if (!user) {
      setStep(0);
    } else if (!profile?.privacy_accepted_at) {
      setStep(1);
    } else if (!profile?.player_name) {
      setStep(2);
    } else {
      const count = (residents ?? []).filter((r) => !(r as any).deleted).length;
      if (count === 0) {
        setStep(3);
      } else if (count === 1) {
        setStep(4);
      } else {
        // 2+ residents but onboarding not marked complete — finish it
        handleComplete();
      }
    }
  }, [ready, user, profile, profileLoading, residents]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = useCallback(async () => {
    // Override redirectTo so OAuth returns directly to /onboarding
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

  const handleAcceptPrivacy = useCallback(async () => {
    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync({
        player_name: profile?.player_name || '_pending',
        privacy_accepted_at: new Date().toISOString(),
      });
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }, [upsertProfile, profile]);

  const handleSubmitName = useCallback(async () => {
    if (!playerName.trim()) return;
    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync({
        player_name: playerName.trim(),
      });
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  }, [upsertProfile, playerName]);

  const handleResident1Done = useCallback(() => {
    setStep(4);
  }, []);

  const handleComplete = useCallback(async () => {
    try {
      await upsertProfile.mutateAsync({
        player_name: profile?.player_name || playerName || 'Player',
        onboarding_completed: true,
      });
      // Force-trigger the first conversation
      void triggerConversationNow({ force: true });
    } catch {
      // best-effort
    }
    router.push('/home');
  }, [upsertProfile, profile, playerName, router]);

  const handleResident2Done = useCallback(() => {
    void handleComplete();
  }, [handleComplete]);

  // Loading state
  if (!ready || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/60 text-sm animate-pulse">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white/90">Reladen へようこそ</h1>
        <p className="text-sm text-white/60">住人たちの暮らす世界をつくりましょう</p>
      </div>

      <StepIndicator current={step} />

      <div className="mt-6">
        {/* Step 0: Login */}
        {step === 0 && (
          <div className="flex flex-col items-center gap-6 py-8">
            <p className="text-white/70 text-center">
              はじめに、Googleアカウントでログインしてください。
            </p>
            <Button onClick={handleSignIn} size="lg">
              Googleでログイン
            </Button>
          </div>
        )}

        {/* Step 1: Privacy Policy */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/20 bg-white/5 p-4 max-h-[50vh] overflow-y-auto text-sm text-white/80 space-y-3">
              <h2 className="text-lg font-semibold text-white/90">プライバシーポリシー</h2>
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

        {/* Step 2: Player Name */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="text-center space-y-2">
              <p className="text-white/70">
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
                {submitting ? '保存中...' : '次へ'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Resident 1 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-white/70">
                最初の住人を登録しましょう。
              </p>
              <p className="text-xs text-white/50">1人目 / 2人</p>
            </div>
            <ResidentForm onSubmitted={handleResident1Done} />
          </div>
        )}

        {/* Step 4: Resident 2 */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-white/70">
                もう1人、住人を登録しましょう。
              </p>
              <p className="text-xs text-white/50">2人目 / 2人</p>
            </div>
            <ResidentForm onSubmitted={handleResident2Done} />
          </div>
        )}
      </div>
    </div>
  );
}
