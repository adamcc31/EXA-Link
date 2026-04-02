import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent } from '@/lib/api/audit';

/**
 * POST /api/auth/logout — Logout user aktif.
 */
export const POST = withAuth(async (ctx: AuthContext) => {
  try {
    const { error } = await ctx.supabase.auth.signOut();

    if (error) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal logout.', 500);
    }

    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'USER_LOGOUT',
      actorType: ctx.user.role,
      actorId: ctx.user.id,
      resourceType: 'user',
      resourceId: ctx.user.id,
    });

    return successResponse({ message: 'Berhasil logout.' });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
