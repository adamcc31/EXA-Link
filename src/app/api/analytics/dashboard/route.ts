import { withAuth, withRole, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { USER_ROLE } from '@/types/enums';

/**
 * GET /api/analytics/dashboard — Ringkasan dashboard.
 * Admin only.
 */
export const GET = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const url = new URL(ctx.request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');

      // Total client
      const { count: totalClients } = await ctx.supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      // Client baru (bulan ini)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: newClients } = await ctx.supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      // Total file diupload bulan ini
      const { count: totalFilesUploaded } = await ctx.supabase
        .from('document_files')
        .select('*', { count: 'exact', head: true })
        .gte('uploaded_at', startOfMonth.toISOString())
        .eq('status', 'active');

      // Total link akses (audit log LINK_ACCESSED)
      const { count: totalLinkAccesses } = await ctx.supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'LINK_ACCESSED')
        .gte('created_at', startOfMonth.toISOString());

      // Total download
      const { count: totalDownloads } = await ctx.supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'FILE_DOWNLOADED')
        .gte('created_at', startOfMonth.toISOString());

      // Token aktif & expired
      const { count: activeTokens } = await ctx.supabase
        .from('client_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString());

      const { count: expiredTokens } = await ctx.supabase
        .from('client_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .lt('expires_at', new Date().toISOString());

      // Tren upload per hari (30 hari terakhir)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data: recentUploads } = await ctx.supabase
        .from('document_files')
        .select('uploaded_at')
        .gte('uploaded_at', thirtyDaysAgo.toISOString())
        .eq('status', 'active')
        .order('uploaded_at', { ascending: true });

      // Agregasi per hari
      const uploadsByDay = aggregateByDay(
        (recentUploads ?? []).map((u) => u.uploaded_at),
      );

      return successResponse({
        period: new Date().toISOString().substring(0, 7),
        summary: {
          total_clients: totalClients ?? 0,
          new_clients: newClients ?? 0,
          total_files_uploaded: totalFilesUploaded ?? 0,
          total_link_accesses: totalLinkAccesses ?? 0,
          total_downloads: totalDownloads ?? 0,
          active_tokens: activeTokens ?? 0,
          expired_tokens: expiredTokens ?? 0,
        },
        trends: {
          uploads_by_day: uploadsByDay,
        },
      });
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
    }
  }),
);

/**
 * Agregasi timestamp array menjadi { date, count } per hari.
 */
function aggregateByDay(
  timestamps: string[],
): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();

  for (const ts of timestamps) {
    const date = ts.substring(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
