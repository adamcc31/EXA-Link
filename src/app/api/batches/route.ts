import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';

export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '20', 10);

    const requestedAgentId = url.searchParams.get('agent_id');

    // Admin melihat sesuai filter (atau semua jika null), agent melihat miliknya saja
    const agentId = ctx.user.role === 'admin' ? requestedAgentId || null : ctx.user.id;

    interface BatchResult {
      batch_id: string;
      batch_title: string;
      created_at: string;
      agent_name: string;
      total_clients: number;
      clients: {
        id: string;
        full_name: string;
        date_of_birth: string;
      }[];
    }

    // @ts-expect-error RPC type not yet generated
    const { data, error } = await ctx.supabase.rpc('get_dashboard_batches', {
      p_page: page,
      p_per_page: perPage,
      p_agent_id: agentId,
    });

    if (error) {
      console.error(error);
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data batch.', 500);
    }

    const batchesData = (data as unknown as BatchResult[]) || [];

    // Kumpulkan semua client_id dari seluruh batch untuk mengambil data token
    const clientIds = batchesData.flatMap((batch) => (batch.clients || []).map((c) => c.id));

    if (clientIds.length > 0) {
      const { data: activeTokens } = await ctx.supabase
        .from('client_tokens')
        .select('client_id, token_prefix, expires_at, is_active, has_opened, has_downloaded')
        .in('client_id', clientIds)
        .eq('is_active', true);

      interface TokenRow {
        client_id: string;
        token_prefix: string;
        expires_at: string;
        is_active: boolean;
        has_opened: boolean;
        has_downloaded: boolean;
      }

      interface TokenData {
        prefix: string;
        expires_at: string;
        is_active: boolean;
        has_opened: boolean;
        has_downloaded: boolean;
      }

      const tokensMap = new Map<string, TokenData>(
        ((activeTokens as unknown as TokenRow[]) ?? []).map((t) => [
          t.client_id,
          {
            prefix: t.token_prefix,
            expires_at: t.expires_at,
            is_active: t.is_active,
            has_opened: t.has_opened,
            has_downloaded: t.has_downloaded,
          },
        ]),
      );

      batchesData.forEach((batch) => {
        if (batch.clients) {
          batch.clients = batch.clients.map((client) => ({
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
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
