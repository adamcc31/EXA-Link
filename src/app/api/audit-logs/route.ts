import { withAuth, withRole, type AuthContext } from '@/lib/api/middleware';
import { successResponse, paginatedResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { USER_ROLE } from '@/types/enums';
import { z } from 'zod/v4';

const listAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
  event_type: z.string().optional(),
  actor_type: z.string().optional(),
  resource_type: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

/**
 * GET /api/audit-logs — Daftar audit logs dengan filter.
 * Admin only.
 */
export const GET = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const url = new URL(ctx.request.url);
      const params = listAuditLogsSchema.parse({
        page: url.searchParams.get('page'),
        per_page: url.searchParams.get('per_page'),
        event_type: url.searchParams.get('event_type') ?? undefined,
        actor_type: url.searchParams.get('actor_type') ?? undefined,
        resource_type: url.searchParams.get('resource_type') ?? undefined,
        date_from: url.searchParams.get('date_from') ?? undefined,
        date_to: url.searchParams.get('date_to') ?? undefined,
      });

      const offset = (params.page - 1) * params.per_page;

      let query = ctx.supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact' });

      if (params.event_type) query = query.eq('event_type', params.event_type);
      if (params.actor_type) query = query.eq('actor_type', params.actor_type as 'client' | 'agent' | 'admin' | 'system');
      if (params.resource_type) query = query.eq('resource_type', params.resource_type as 'client' | 'file' | 'token' | 'user' | 'batch' | 'system');
      if (params.date_from) query = query.gte('created_at', `${params.date_from}T00:00:00Z`);
      if (params.date_to) query = query.lte('created_at', `${params.date_to}T23:59:59Z`);

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + params.per_page - 1);

      const { data: logs, count, error } = await query;

      if (error) {
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil audit logs.', 500);
      }

      return paginatedResponse(logs ?? [], {
        page: params.page,
        per_page: params.per_page,
        total: count ?? 0,
      });
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
    }
  }),
);
