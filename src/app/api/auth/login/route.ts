import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';

/**
 * POST /api/auth/login — Login menggunakan email dan password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Email dan password wajib diisi.',
        400,
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return errorResponse(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Email atau password salah.',
        401,
      );
    }

    // Ambil profil user dari tabel users
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active')
      .eq('id', data.user.id)
      .single();

    if (profileError || !userProfile) {
      return errorResponse(
        ERROR_CODES.UNAUTHORIZED,
        'Profil pengguna tidak ditemukan. Hubungi administrator.',
        401,
      );
    }

    if (!userProfile.is_active) {
      await supabase.auth.signOut();
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        'Akun Anda telah dinonaktifkan.',
        403,
      );
    }

    // Audit log
    const supabaseAdmin = await createAdminClient();
    await logAuditEvent(supabaseAdmin, {
      eventType: 'USER_LOGIN',
      actorType: userProfile.role as 'admin' | 'agent',
      actorId: userProfile.id,
      resourceType: 'user',
      resourceId: userProfile.id,
      ipAddress: getClientIp(request),
      userAgent: getClientUserAgent(request),
    });

    return successResponse({
      user: userProfile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
}
