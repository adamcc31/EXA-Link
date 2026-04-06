import { NextRequest } from 'next/server';
import { createClient as createCoreClient } from '@supabase/supabase-js';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { hashToken } from '@/features/tokens/lib/crypto';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

/**
 * Verifikasi session JWT dari cookie.
 */
async function verifySession(
  request: NextRequest,
  rawToken: string,
): Promise<{ clientId: string } | null> {
  const sessionCookie = request.cookies.get('exata_session')?.value;
  if (!sessionCookie) return null;

  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { payload } = await jwtVerify(sessionCookie, secret);

    const tokenHash = hashToken(rawToken);
    if (payload.token_hash !== tokenHash) return null;

    return { clientId: payload.client_id as string };
  } catch {
    return null;
  }
}

/**
 * GET /api/access/[token]/documents/[fileId]/download — Download file via signed URL.
 * Mengembalikan signed URL yang berlaku 5 menit.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; fileId: string }> },
) {
  try {
    const { token: rawToken, fileId } = await params;

    const session = await verifySession(request, rawToken);
    if (!session) {
      return errorResponse(
        ERROR_CODES.UNAUTHORIZED,
        'Sesi tidak valid. Silakan verifikasi ulang identitas Anda.',
        401,
      );
    }

    // Gunakan pure Core client agar request bersih dari intercept cookie (murni Service Role bypass)
    const supabaseAdmin = createCoreClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Ambil info file dan verifikasi bahwa file milik client ini
    const { data: fileRecord, error } = await supabaseAdmin
      .from('document_files')
      .select('id, document_id, storage_path, original_file_name, file_size')
      .eq('id', fileId)
      .eq('status', 'active')
      .single();

    if (error || !fileRecord) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        `File tidak ditemukan. Error DB: ${error?.message || 'PGRSTx'} (ID: ${fileId})`,
        404,
      );
    }

    // Ambil dokumen parent untuk verifikasi client_id secara terpisah menghindari bug inner join postgREST
    const { data: documentRecord, error: docError } = await supabaseAdmin
      .from('documents')
      .select('client_id')
      .eq('id', fileRecord.document_id)
      .single();

    if (docError || !documentRecord) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        `Dokumen parent tidak valid untuk diverifikasi.`,
        404,
      );
    }

    // Verifikasi file milik client yang terverifikasi
    if (documentRecord.client_id !== session.clientId) {
      return errorResponse(ERROR_CODES.FORBIDDEN, 'Anda tidak memiliki akses ke file ini.', 403);
    }

    // Generate signed URL (5 menit)
    const SIGNED_URL_EXPIRY = 300; // 5 menit dalam detik
    const { data: signedUrlData, error: signedError } = await supabaseAdmin.storage
      .from('client-documents')
      .createSignedUrl(fileRecord.storage_path, SIGNED_URL_EXPIRY, {
        download: true,
      });

    if (signedError || !signedUrlData) {
      console.error('CreateSignedUrl Error:', signedError);
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Gagal membuat link download. Detail: ${signedError?.message || 'Unknown'}`,
        500,
      );
    }

    // Audit log
    await logAuditEvent(supabaseAdmin, {
      eventType: 'FILE_DOWNLOADED',
      actorType: 'client',
      resourceType: 'file',
      resourceId: fileRecord.id,
      metadata: {
        file_name: fileRecord.original_file_name,
        file_size: fileRecord.file_size,
        client_id: session.clientId,
      },
      ipAddress: getClientIp(request),
      userAgent: getClientUserAgent(request),
    });

    return successResponse({
      download_url: signedUrlData.signedUrl,
      expires_in_seconds: SIGNED_URL_EXPIRY,
      file_name: fileRecord.original_file_name,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Download Route Unhandled Exception:', err);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      `Terjadi kesalahan internal: ${errorMsg}`,
      500,
    );
  }
}
