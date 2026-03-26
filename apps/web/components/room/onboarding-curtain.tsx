'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile, useUpsertPlayerProfile } from '@/lib/data/player-profile';
import { signInWithGooglePopup } from '@/lib/auth/sign-in-popup';
import {
  getOnboardingStep,
  setOnboardingStep,
  getPrivacyAcceptedAt,
  setPrivacyAcceptedAt,
  clearOnboardingStorage,
} from '@/lib/onboarding/onboarding-storage';
import { StepIndicator } from '@/components/onboarding/step-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * カーテン上に表示されるオンボーディングUI。
 *
 * Steps:
 * 0 - 選択画面: 「新規で開始」/「ログインして続ける」
 * 1 - プラポリ同意 (新規のみ)
 * 2 - Googleログイン (ポップアップ)
 * 3 - プレイヤー名入力 → onComplete
 */
type Props = {
  onComplete: () => void;
};

export function OnboardingCurtain({ onComplete }: Props) {
  const { ready, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = usePlayerProfile();
  const upsertProfile = useUpsertPlayerProfile();

  const [step, setStep] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isNewGame, setIsNewGame] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // 初期ステップの判定
  useEffect(() => {
    if (!ready || profileLoading) return;

    // 既に完了済み → 親に通知
    if (profile?.onboarding_completed) {
      onComplete();
      return;
    }

    if (user) {
      // ログイン済み — プロフィールの状態からステップ判定
      if (!profile?.privacy_accepted_at) {
        // プラポリ未同意（localStorageに同意があれば転記）
        const lsPrivacy = getPrivacyAcceptedAt();
        if (lsPrivacy) {
          void transferPrivacyAndAdvance(lsPrivacy);
        } else {
          setIsNewGame(true);
          setStep(1);
        }
      } else if (!profile?.player_name || profile.player_name === '_pending') {
        setStep(3);
      } else {
        // 名前設定済み → 完了
        onComplete();
      }
    } else {
      // 未ログイン — localStorageからステップ復元
      const savedStep = getOnboardingStep();
      if (savedStep > 0) {
        setIsNewGame(true);
        setStep(savedStep);
      } else {
        setStep(0);
      }
    }
  }, [ready, user, profile, profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ログイン検知: ポップアップ完了後にuserが更新される
  useEffect(() => {
    if (!user || !ready) return;
    if (step === 2 || loggingIn) {
      // ログインした → localStorage の同意を転記してステップ3へ
      const lsPrivacy = getPrivacyAcceptedAt();
      if (lsPrivacy) {
        void transferPrivacyAndAdvance(lsPrivacy);
      } else if (profile?.privacy_accepted_at) {
        // 既にプロフィールに同意がある（既存ユーザー）
        if (profile.onboarding_completed) {
          onComplete();
        } else if (profile.player_name && profile.player_name !== '_pending') {
          onComplete();
        } else {
          setStep(3);
        }
      } else {
        setStep(3);
      }
      setLoggingIn(false);
    }
  }, [user, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** localStorage の privacy_accepted_at をプロフィールに転記 */
  const transferPrivacyAndAdvance = useCallback(async (privacyAt: string) => {
    try {
      await upsertProfile.mutateAsync({
        player_name: profile?.player_name || '_pending',
        privacy_accepted_at: privacyAt,
      });
      clearOnboardingStorage();
      setStep(3);
    } catch {
      setStep(1); // 失敗時はプラポリからやり直し
    }
  }, [upsertProfile, profile]);

  // --- ハンドラー ---

  const handleNewGame = useCallback(() => {
    setIsNewGame(true);
    setOnboardingStep(1);
    setStep(1);
  }, []);

  const handleLoginContinue = useCallback(async () => {
    setLoggingIn(true);
    try {
      await signInWithGooglePopup();
    } catch {
      setLoggingIn(false);
    }
  }, []);

  const handleAcceptPrivacy = useCallback(() => {
    const now = new Date().toISOString();
    setPrivacyAcceptedAt(now);
    setOnboardingStep(2);
    setStep(2);
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setLoggingIn(true);
    try {
      await signInWithGooglePopup();
      // ログイン検知はuseEffectで処理
    } catch {
      setLoggingIn(false);
    }
  }, []);

  const handleSubmitName = useCallback(async () => {
    if (!playerName.trim()) return;
    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync({
        player_name: playerName.trim(),
        privacy_accepted_at: profile?.privacy_accepted_at || new Date().toISOString(),
        onboarding_completed: false,
      });
      clearOnboardingStorage();
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }, [upsertProfile, playerName, profile, onComplete]);

  // --- レンダリング ---

  if (!ready || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/40 text-sm animate-pulse">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white/90">Reladen</h1>
          <p className="text-sm text-white/50">住人たちの暮らす世界をつくりましょう</p>
        </div>

        {step > 0 && <StepIndicator current={step} />}

        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 backdrop-blur-sm">
          {/* Step 0: 選択画面 */}
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
                  disabled={loggingIn}
                >
                  {loggingIn ? 'ログイン中...' : 'ログインして続ける'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: プラポリ同意 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/15 bg-white/5 p-4 max-h-[40vh] overflow-y-auto text-sm text-white/70 space-y-3">
                <h2 className="text-base font-semibold text-white/80">プライバシーポリシー</h2>
                <p>Reladenでは、ゲーム体験の提供のために以下の情報を利用します。</p>
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
                <Button onClick={handleAcceptPrivacy} size="lg">
                  同意して次へ
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Googleログイン (ポップアップ) */}
          {step === 2 && (
            <div className="flex flex-col items-center gap-6">
              <p className="text-white/70 text-center text-sm">
                Googleアカウントでログインしてください。
              </p>
              <Button onClick={handleGoogleLogin} size="lg" disabled={loggingIn}>
                {loggingIn ? 'ログイン中...' : 'Googleでログイン'}
              </Button>
            </div>
          )}

          {/* Step 3: プレイヤー名 */}
          {step === 3 && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-2">
                <p className="text-white/70 text-sm">あなたの名前を教えてください。</p>
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
    </div>
  );
}
