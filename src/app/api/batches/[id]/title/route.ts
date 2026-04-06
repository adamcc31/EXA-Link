import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';

export const PATCH = withAuth(async (ctx: AuthContext) => {
  try {
    const batchId = ctx.request.nextUrl.pathname.split('/').slice(-2, -1)[0];
    const body = await ctx.request.json();
    const newTitle = body.title;

    if (!newTitle || typeof newTitle !== 'string') {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Judul batch tidak valid.', 400);
    }

    // @ts-expect-error RPC type not yet generated
    const { error } = await ctx.supabase.rpc('update_dashboard_batch_title', {
      p_batch_id: batchId,
      p_new_title: newTitle,
      p_user_id: ctx.user.id,
    });

    if (error) {
      console.error('Update batch title error:', error);
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengupdate judul batch.', 500);
    }

    return successResponse({ batch_id: batchId, batch_title: newTitle });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
