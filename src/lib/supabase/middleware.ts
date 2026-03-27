import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

/**
 * Memperbarui session Supabase Auth di middleware Next.js.
 *
 * PENTING: Menggunakan `supabase.auth.getUser()` bukan `getSession()`
 * karena getUser() memvalidasi JWT langsung dengan server Supabase Auth,
 * sedangkan getSession() hanya membaca JWT dari cookie tanpa validasi server.
 * Ini mencegah penggunaan token yang sudah di-revoke atau dimanipulasi.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // KRITIKAL: Gunakan getUser() — BUKAN getSession()
  // getUser() mengirim request ke Supabase Auth server untuk validasi
  // getSession() hanya membaca JWT tanpa validasi server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
