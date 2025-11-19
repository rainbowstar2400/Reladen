// apps/web/lib/supabase/server.ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types';

export function sbServer() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name: string, options: any) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    }
  );
}
