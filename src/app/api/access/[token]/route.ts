import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { checkRateLimit, rateLimitHeaders } from '@/lib/api/rate-limit';
import { hashToken } from '@/features/tokens/lib/crypto';
import { maskNama } from '@/lib/utils';

/**
 * GET /api/access/[token] — Validasi token akses client.
 * Public endpoint — tidak memerlukan autentikasi.
 *
 * Mengecek:
 * 1. Token valid (hash ditemukan di DB)
 * 2. Token aktif (is_active = true)
 * 3. Belum expired
 * 4. Tidak sedang di-lock
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await params;
    const supabaseAdmin = await createAdminClient();

    // Rate limiting: 30 req/menit per IP
    const clientIp = getClientIp(request) ?? 'unknown';
    const rateLimit = await checkRateLimit(supabaseAdmin, `ip:${clientIp}`, 1, 30);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.RATE_LIMITED,
            message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
          },
        },
        {
          status: 429,
          headers: { ...rateLimitHeaders(30, rateLimit.remaining, 1) },
        },
      );
    }

    // Hash token untuk lookup
    const tokenHash = hashToken(rawToken);

    // Query token dari database
    const { data: tokenRecord, error } = await supabaseAdmin
      .from('client_tokens')
      .select('id, client_id, expires_at, is_active, failed_attempts, locked_until')
      .eq('token_hash', tokenHash)
      .single();

    // Token tidak ditemukan — response konstan untuk mencegah enumeration
    if (error || !tokenRecord) {
      return errorResponse(
        ERROR_CODES.TOKEN_NOT_FOUND,
        'Link tidak valid atau sudah kadaluarsa.',
        404,
      );
    }

    // Token tidak aktif
    if (!tokenRecord.is_active) {
      return errorResponse(
        ERROR_CODES.TOKEN_NOT_FOUND,
        'Link tidak valid atau sudah kadaluarsa.',
        404,
      );
    }

    // Token expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return errorResponse(
        ERROR_CODES.TOKEN_EXPIRED,
        'Link sudah kadaluarsa. Silakan hubungi agen Anda untuk meminta link baru.',
        403,
      );
    }

    // Token di-lock karena terlalu banyak percobaan gagal
    if (tokenRecord.locked_until && new Date(tokenRecord.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil(
        (new Date(tokenRecord.locked_until).getTime() - Date.now()) / 60000,
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_LOCKED,
            message: `Link terkunci sementara karena terlalu banyak percobaan. Silakan coba lagi dalam ${minutesRemaining} menit.`,
            retry_after_minutes: minutesRemaining,
          },
        },
        { status: 403 },
      );
    }

    // Ambil nama client untuk hint
    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('full_name')
      .eq('id', tokenRecord.client_id)
      .single();

    const maskedName = clientData ? maskNama(clientData.full_name) : '***';

    // Audit log: link diakses
    await logAuditEvent(supabaseAdmin, {
      eventType: 'LINK_ACCESSED',
      actorType: 'client',
      resourceType: 'token',
      resourceId: tokenRecord.id,
      metadata: { token_prefix: rawToken.substring(0, 8) },
      ipAddress: getClientIp(request),
      userAgent: getClientUserAgent(request),
    });

    return successResponse({
      status: 'challenge_required',
      client_name_hint: maskedName,
      message: 'Silakan masukkan tanggal lahir Anda untuk mengakses dokumen.',
    });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
}
