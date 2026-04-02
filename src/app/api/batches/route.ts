import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';

export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '20', 10);
    
    // Admin melihat semua, agent melihat miliknya saja
    const agentId = ctx.user.role === 'admin' ? null : ctx.user.id;

    // Panggil RPC (ignore TS warning karena tipe database.ts belum diregenerate)
    const { data, error } = await (ctx.supabase.rpc as any)('get_dashboard_batches', {
      p_page: page,
      p_per_page: perPage,
      p_agent_id: agentId,
    });

    if (error) {
      console.error(error);
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data batch.', 500);
    }

    const batchesData = data || [];
    
    // Kumpulkan semua client_id dari seluruh batch untuk mengambil data token
    const clientIds = batchesData.flatMap((batch: any) => 
      (batch.clients || []).map((c: any) => c.id)
    );

    if (clientIds.length > 0) {
      const { data: activeTokens } = await (ctx.supabase
        .from('client_tokens')
        .select('client_id, token_prefix, expires_at, is_active, has_opened, has_downloaded')
        .in('client_id', clientIds)
        .eq('is_active', true) as any);

      const tokensMap = new Map(
        (activeTokens ?? []).map((t: any) => [
          t.client_id,
          { prefix: t.token_prefix, expires_at: t.expires_at, is_active: t.is_active, has_opened: t.has_opened, has_downloaded: t.has_downloaded },
        ]),
      );

      batchesData.forEach((batch: any) => {
        if (batch.clients) {
            batch.clients = batch.clients.map((client: any) => ({
              ...client,
              active_token: tokensMap.get(client.id) ?? null,
            }));
        }
      });
    }

    return successResponse({
      data: batchesData,
      page,
      per_page: perPage,
    });

  } catch (err: any) {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
