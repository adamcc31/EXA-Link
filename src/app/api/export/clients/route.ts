import { NextResponse } from 'next/server';
import { withAuth, withRole, type AuthContext } from '@/lib/api/middleware';
import { errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { USER_ROLE } from '@/types/enums';

/**
 * GET /api/export/clients — Export data client ke CSV.
 * Admin only.
 */
export const GET = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const url = new URL(ctx.request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');

      let query = ctx.supabase
        .from('clients')
        .select('id, full_name, date_of_birth, phone, email, notes, created_at');

      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`);

      query = query.order('created_at', { ascending: false });

      const { data: clients, error } = await query;

      if (error) {
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data client.', 500);
      }

      // Generate CSV
      const header = 'ID,Nama Lengkap,Tanggal Lahir,Telepon,Email,Catatan,Dibuat Pada\n';
      const rows = (clients ?? [])
        .map((c) =>
          [
            c.id,
            `"${c.full_name}"`,
            c.date_of_birth,
            c.phone ?? '',
            c.email ?? '',
            `"${(c.notes ?? '').replace(/"/g, '""')}"`,
            c.created_at,
          ].join(','),
        )
        .join('\n');

      const csv = header + rows;
      const filename = `clients_export_${new Date().toISOString().substring(0, 10)}.csv`;

      // Audit log
      await logAuditEvent(ctx.supabaseAdmin, {
        eventType: 'DATA_EXPORTED',
        actorType: 'admin',
        actorId: ctx.user.id,
        resourceType: 'system',
        metadata: {
          export_type: 'clients',
          format: 'csv',
          record_count: (clients ?? []).length,
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
