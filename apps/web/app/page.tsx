// apps/web/app/page.tsx  ← 'use client' は付けない（Server Component）
import { redirect } from 'next/navigation';

export default function RootRedirect() {
  redirect('/home'); // 開いた瞬間に /home へ
}
