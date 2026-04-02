import { NextResponse } from 'next/server';
import { withAuth, withRole, type AuthContext } from '@/lib/api/middleware';
import { errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { USER_ROLE } from '@/types/enums';

/**
 * GET /api/export/audit-logs — Export audit logs ke CSV.
 * Admin only. date_from dan date_to wajib.
 */
export const GET = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const url = new URL(ctx.request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const eventType = url.searchParams.get('event_type');

      if (!dateFrom || !dateTo) {
        return errorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Parameter date_from dan date_to wajib diisi.',
          400,
        );
      }

      let query = ctx.supabaseAdmin
        .from('audit_logs')
        .select('id, event_type, actor_type, actor_id, resource_type, resource_id, metadata, ip_address, user_agent, created_at')
        .gte('created_at', `${dateFrom}T00:00:00Z`)
        .lte('created_at', `${dateTo}T23:59:59Z`);

      if (eventType) query = query.eq('event_type', eventType);

      query = query.order('created_at', { ascending: false }).limit(10000);

      const { data: logs, error } = await query;

      if (error) {
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil audit logs.', 500);
      }

      // Generate CSV
      const header = 'ID,Event,Aktor,Aktor ID,Resource,Resource ID,IP Address,User Agent,Waktu\n';
      const rows = (logs ?? [])
        .map((l) =>
          [
            l.id,
            l.event_type,
            l.actor_type,
            l.actor_id ?? '',
            l.resource_type,
            l.resource_id ?? '',
            l.ip_address ?? '',
            `"${(l.user_agent ?? '').replace(/"/g, '""')}"`,
            l.created_at,
          ].join(','),
        )
        .join('\n');

      const csv = header + rows;
      const filename = `audit_logs_${dateFrom}_${dateTo}.csv`;

      await logAuditEvent(ctx.supabaseAdmin, {
        eventType: 'DATA_EXPORTED',
        actorType: 'admin',
        actorId: ctx.user.id,
        resourceType: 'system',
        metadata: {
          export_type: 'audit_logs',
          format: 'csv',
          record_count: (logs ?? []).length,
          date_from: dateFrom,
          date_to: dateTo,
        },
        ipAddress: getClientIp(ctx.request),
        userAgent: getClientUserAgent(ctx.request),
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
    }
  }),
);
