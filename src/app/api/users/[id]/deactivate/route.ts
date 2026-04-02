import { withAuth, withRole, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { USER_ROLE } from '@/types/enums';

/**
 * PATCH /api/users/[id]/deactivate — Nonaktifkan user.
 * Admin only.
 */
export const PATCH = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const userId = ctx.request.nextUrl.pathname.split('/').at(-2);

      if (userId === ctx.user.id) {
        return errorResponse(
          ERROR_CODES.FORBIDDEN,
          'Anda tidak dapat menonaktifkan akun Anda sendiri.',
          403,
        );
      }

      const { data: user, error } = await ctx.supabaseAdmin
        .from('users')
        .update({ is_active: false })
        .eq('id', userId!)
        .select('id, email, full_name')
        .single();

      if (error || !user) {
        return errorResponse(ERROR_CODES.NOT_FOUND, 'User tidak ditemukan.', 404);
      }

      await logAuditEvent(ctx.supabaseAdmin, {
        eventType: 'USER_CREATED',
        actorType: 'admin',
        actorId: ctx.user.id,
        resourceType: 'user',
        resourceId: user.id,
        metadata: { action: 'deactivated', email: user.email },
        ipAddress: getClientIp(ctx.request),
        userAgent: getClientUserAgent(ctx.request),
      });

      return successResponse({ message: 'User berhasil dinonaktifkan.' });
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
    }
  }),
);
