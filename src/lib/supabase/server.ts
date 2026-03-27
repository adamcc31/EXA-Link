import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Membuat Supabase client untuk penggunaan di sisi server:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 *
 * Client ini mengelola cookie otomatis untuk session management.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // Fungsi setAll dipanggil dari Server Component — abaikan.
            // Ini terjadi saat middleware sudah men-set cookie sebelumnya.
          }
        },
      },
    },
  );
}
