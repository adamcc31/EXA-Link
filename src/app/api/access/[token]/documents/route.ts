import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { hashToken } from '@/features/tokens/lib/crypto';
import { jwtVerify } from 'jose';

/**
 * Verifikasi session JWT dari cookie exata_session.
 */
async function verifySession(
  request: NextRequest,
  rawToken: string,
): Promise<{ clientId: string; tokenHash: string; tokenType: string } | null> {
  const sessionCookie = request.cookies.get('exata_session')?.value;
  if (!sessionCookie) return null;

  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { payload } = await jwtVerify(sessionCookie, secret);

    const tokenHash = hashToken(rawToken);
    if (payload.token_hash !== tokenHash) return null;

    return {
      clientId: payload.client_id as string,
      tokenHash: tokenHash,
      tokenType: payload.token_type as string,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/access/[token]/documents — Daftar dokumen client.
 * Memerlukan session JWT yang valid dari challenge verification.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await params;

    const session = await verifySession(request, rawToken);
    if (!session) {
      return errorResponse(
        ERROR_CODES.UNAUTHORIZED,
        'Sesi tidak valid. Silakan verifikasi ulang identitas Anda.',
        401,
      );
    }

    const supabaseAdmin = await createAdminClient();

    // Ambil data client
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('full_name')
      .eq('id', session.clientId)
      .single();

    // Ambil dokumen dengan file aktif
    const { data: documents, error } = await supabaseAdmin
      .from('documents')
      .select(`
        id, document_type, title, created_at, document_year,
        document_files (
          id, original_file_name, file_size, mime_type, uploaded_at
        )
      `)
      .eq('client_id', session.clientId)
      .eq('category', session.tokenType)
      .eq('document_files.status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data dokumen.', 500);
    }

    // Filter dokumen yang memiliki file aktif
    const documentsWithFiles = (documents ?? [])
      .filter((doc) => doc.document_files && doc.document_files.length > 0)
      .map((doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        title: doc.title,
        files: doc.document_files.map((f) => ({
          id: f.id,
          original_file_name: f.original_file_name,
          file_size: f.file_size,
          uploaded_at: f.uploaded_at,
        })),
        document_year: doc.document_year,
      }));

    return successResponse({
      client_name: client?.full_name ?? 'Client',
      documents: documentsWithFiles,
    });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
}
