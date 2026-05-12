import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

/**
 * Membuat Supabase admin client menggunakan Service Role Key.
 * HANYA digunakan untuk operasi yang membutuhkan bypass RLS:
 * - Pembuatan user baru (auth.admin.createUser)
 * - Rate limiting (insert ke rate_limits tanpa RLS)
 * - Audit logging dari public endpoints
 */
export async function createAdminClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Abaikan jika dipanggil dari Server Component read-only context
          }
        },
      },
    },
  );
}
