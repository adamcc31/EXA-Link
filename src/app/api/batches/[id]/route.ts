import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { createClient as createCoreClient } from '@supabase/supabase-js';

/**
 * DELETE /api/batches/[id] — Hapus seluruh client dari suatu batch beserta file-file (admin only).
 */
export const DELETE = withAuth(async (ctx: AuthContext) => {
  try {
    if (ctx.user.role !== 'admin') {
      return errorResponse(ERROR_CODES.FORBIDDEN, 'Hanya admin yang dapat menghapus batch.', 403);
    }

    const id = ctx.request.nextUrl.pathname.split('/').pop();

    if (!id) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'ID batch tidak valid.', 400);
    }

    // 1. Cari semua file_log (audit_logs) yang merupakan bagian dari batch ini untuk menemukan client_id
    const { data: clientLogs, error: logError } = await ctx.supabase
      .from('audit_logs')
      .select('metadata')
      .eq('event_type', 'FILE_UPLOADED')
      .filter('metadata->>batch_id', 'eq', id);

    if (logError) {
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Gagal mengambil data klien untuk batch ini.',
        500,
      );
    }

    // Ekstrak client UUIDs
    const clientIds = Array.from(
      new Set((clientLogs || []).map((log) => log.metadata?.client_id as string).filter(Boolean)),
    );

    // Buat service-role client murni (tanpa cookie/RLS) untuk operasi destruktif
    const adminClient = createCoreClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    if (clientIds.length > 0) {
      // 2. Cari semua dokumen untuk client-client tersebut
      const { data: documents } = await adminClient
        .from('documents')
        .select('id')
        .in('client_id', clientIds);

      if (documents && documents.length > 0) {
        const docIds = documents.map((d: { id: string }) => d.id);
        const { data: files } = await adminClient
          .from('document_files')
          .select('storage_path')
          .in('document_id', docIds);

        // 3. Hapus file-file dari storage bucket
        if (files && files.length > 0) {
          const paths = files.map((f: { storage_path: string }) => f.storage_path);

          // Bagi paths ke dalam chunk berisi maksimal 100 item jika banyak
          for (let i = 0; i < paths.length; i += 100) {
            const chunk = paths.slice(i, i + 100);
            await adminClient.storage.from('client-documents').remove(chunk);
          }
        }
      }

      // 4. Hapus clients dari database (akan men-cascade tabel lainnya seperti documents, tokens, dll)
      const { error: deleteError } = await adminClient.from('clients').delete().in('id', clientIds);

      if (deleteError) {
        console.error('Gagal menghapus klien:', deleteError);
        return errorResponse(
          ERROR_CODES.INTERNAL_ERROR,
          'Gagal menghapus klien dari database.',
          500,
        );
      }
    }

    // 5. Hapus batch log itu sendiri agar tidak muncul di dashboard
    // Menggunakan adminClient (service_role raw) karena audit_logs tidak memiliki DELETE policy pada RLS
    const { data: deletedRows, error: batchLogDeleteError } = await adminClient
      .from('audit_logs')
      .delete()
      .eq('id', id)
      .select('id');

    console.log(
      `[BATCH DELETE] audit_logs delete result — rows: ${JSON.stringify(deletedRows)}, error: ${JSON.stringify(batchLogDeleteError)}`,
    );

    if (batchLogDeleteError) {
      console.error('Gagal menghapus row batch di audit_logs:', batchLogDeleteError);
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Batch log gagal dihapus dari audit_logs.',
        500,
      );
    }

    // 6. Catat audit trail untuk penghapusan batch
    await logAuditEvent(adminClient, {
      eventType: 'BATCH_DELETED',
      actorType: 'admin',
      actorId: ctx.user.id,
      resourceType: 'system',
      resourceId: id,
      metadata: { deleted_clients_count: clientIds.length },
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    return successResponse({ message: 'Batch dan seluruh data terkait berhasil dihapus.' });
  } catch (error) {
    console.error('Batch delete error:', error);
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
