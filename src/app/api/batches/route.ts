import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '20', 10);

    const requestedAgentId = url.searchParams.get('agent_id');

    // Admin melihat sesuai filter (atau semua jika null), agent melihat miliknya saja
    const agentId = ctx.user.role === 'admin' ? requestedAgentId || null : ctx.user.id;

    interface RpcClientItem {
      id: string;
      full_name: string;
      date_of_birth: string;
      phone: string | null;
      pic_name: string | null;
      document_count: number;
      has_opened: boolean;
      has_downloaded: boolean;
      is_active: boolean;
      token_prefix: string | null;
      expires_at: string | null;
    }

    interface BatchResult {
      batch_id: string;
      batch_title: string;
      created_at: string;
      agent_name: string;
      total_clients: number;
      clients: RpcClientItem[];
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

    // Construct active_token langsung dari data JSONB RPC (sudah include field token)
    batchesData.forEach((batch) => {
      if (batch.clients) {
        batch.clients = batch.clients.map((client) => ({
          ...client,
          active_token:
            client.is_active && client.expires_at
              ? {
                  prefix: client.token_prefix ?? '',
                  expires_at: client.expires_at,
                  is_active: client.is_active,
                  has_opened: client.has_opened,
                  has_downloaded: client.has_downloaded,
                }
              : null,
        }));
      }
    });

    return successResponse({
      data: batchesData,
      page,
      per_page: perPage,
    });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
