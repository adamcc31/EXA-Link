import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';

/**
 * GET /api/auth/me — Ambil profil user yang sedang login.
 */
export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    return successResponse(ctx.user);
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
