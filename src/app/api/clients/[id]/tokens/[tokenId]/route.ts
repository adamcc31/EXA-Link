import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';

/**
 * DELETE /api/clients/[id]/tokens/[tokenId] — Revoke token.
 */
export const DELETE = withAuth(async (ctx: AuthContext) => {
  try {
    const pathParts = ctx.request.nextUrl.pathname.split('/');
    const tokenId = pathParts[pathParts.length - 1];
    const clientId = pathParts[pathParts.indexOf('clients') + 1];

    const { data: token, error } = await ctx.supabase
      .from('client_tokens')
      .update({ is_active: false })
      .eq('id', tokenId)
      .eq('client_id', clientId)
      .select('id, token_prefix')
      .single();

    if (error || !token) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Token tidak ditemukan.', 404);
    }

    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'TOKEN_REVOKED',
      actorType: ctx.user.role,
      actorId: ctx.user.id,
      resourceType: 'token',
      resourceId: token.id,
      metadata: { token_prefix: token.token_prefix, reason: 'manual_revoke' },
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    return successResponse({ message: 'Token berhasil direvoke.' });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
