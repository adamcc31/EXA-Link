import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { errorResponse, ERROR_CODES } from '@/lib/api/response';
import type { UserRole } from '@/types/enums';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Context yang tersedia di setiap handler API yang terautentikasi.
 */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
  };
  supabase: SupabaseClient<Database>;
  supabaseAdmin: SupabaseClient<Database>;
  request: NextRequest;
}

type AuthenticatedHandler = (ctx: AuthContext) => Promise<NextResponse>;

/**
 * Middleware wrapper untuk API route yang memerlukan autentikasi.
 * Memvalidasi JWT, memastikan user aktif, dan menyediakan AuthContext.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    const supabase = await createClient();
    const supabaseAdmin = await createAdminClient();

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return errorResponse(ERROR_CODES.UNAUTHORIZED, 'Sesi tidak valid. Silakan login kembali.', 401);
    }

    // Ambil profil user dari tabel users
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active')
      .eq('id', authUser.id)
      .single();

    if (error || !userProfile) {
      return errorResponse(ERROR_CODES.UNAUTHORIZED, 'Profil pengguna tidak ditemukan.', 401);
    }

    if (!userProfile.is_active) {
      return errorResponse(ERROR_CODES.FORBIDDEN, 'Akun Anda telah dinonaktifkan.', 403);
    }

    return handler({
      user: userProfile as AuthContext['user'],
      supabase,
      supabaseAdmin,
      request,
    });
  };
}

/**
 * Middleware wrapper untuk membatasi akses berdasarkan role.
 * Digunakan bersama withAuth: withAuth(withRole(['admin'], handler))
 */
export function withRole(allowedRoles: UserRole[], handler: AuthenticatedHandler): AuthenticatedHandler {
  return async (ctx: AuthContext) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        'Anda tidak memiliki izin untuk mengakses resource ini.',
        403,
      );
    }
    return handler(ctx);
  };
}
