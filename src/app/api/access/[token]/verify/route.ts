import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { hashToken } from '@/features/tokens/lib/crypto';
import { z } from 'zod/v4';
import { SignJWT } from 'jose';

const verifySchema = z.object({
  date_of_birth: z.string().min(8, 'Format tidak memadai'),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const SESSION_EXPIRY_HOURS = 2;

/**
 * POST /api/access/[token]/verify — Challenge verification.
 * Client mengirimkan tanggal lahir untuk verifikasi identitas.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await params;
    const supabaseAdmin = await createAdminClient();
    const tokenHash = hashToken(rawToken);

    // Rate limiting: 5 attempts per 30 menit per token
    const rateLimit = await checkRateLimit(supabaseAdmin, `challenge:${tokenHash}`, LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.RATE_LIMITED,
            message: 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
          },
        },
        { status: 429 },
      );
    }

    // Validasi body
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Format tanggal lahir tidak valid.', 400);
    }
    
    let normalizedInputDob = parsed.data.date_of_birth;
    // Normalize DD/MM/YYYY to YYYY-MM-DD for reliable comparison
    if (normalizedInputDob.includes('/')) {
        const parts = normalizedInputDob.split('/');
        if (parts.length === 3) {
            normalizedInputDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    } else if (normalizedInputDob.includes('-')) {
        const parts = normalizedInputDob.split('-');
        if (parts.length === 3 && parts[0].length === 2) {
             normalizedInputDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }

    // Lookup token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('client_tokens')
      .select('id, client_id, expires_at, is_active, failed_attempts, locked_until')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenRecord || !tokenRecord.is_active) {
      return errorResponse(ERROR_CODES.TOKEN_NOT_FOUND, 'Link tidak valid atau sudah kadaluarsa.', 404);
    }

    // Cek expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return errorResponse(ERROR_CODES.TOKEN_EXPIRED, 'Link sudah kadaluarsa.', 403);
    }

    // Cek locked
    if (tokenRecord.locked_until && new Date(tokenRecord.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil(
        (new Date(tokenRecord.locked_until).getTime() - Date.now()) / 60000,
      );
      return errorResponse(
        ERROR_CODES.TOKEN_LOCKED,
        `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutesRemaining} menit.`,
        403,
      );
    }

    // Ambil tanggal lahir client
    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('id, date_of_birth, full_name')
      .eq('id', tokenRecord.client_id)
      .single();

    if (!clientData) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Data client tidak ditemukan.', 404);
    }

    // Verifikasi tanggal lahir (Pastikan format DB konsisten dgn YYYY-MM-DD)
    const isMatch = clientData.date_of_birth === normalizedInputDob;

    if (!isMatch) {
      const newAttempts = tokenRecord.failed_attempts + 1;
      const isLockout = newAttempts >= MAX_FAILED_ATTEMPTS;

      // Update failed_attempts dan locked_until jika lockout
      await supabaseAdmin
        .from('client_tokens')
        .update({
          failed_attempts: newAttempts,
          ...(isLockout
            ? { locked_until: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString() }
            : {}),
        })
        .eq('id', tokenRecord.id);

      // Audit log
      await logAuditEvent(supabaseAdmin, {
        eventType: isLockout ? 'CHALLENGE_LOCKOUT' : 'CHALLENGE_FAILED',
        actorType: 'client',
        resourceType: 'token',
        resourceId: tokenRecord.id,
        metadata: { attempt: newAttempts },
        ipAddress: getClientIp(request),
        userAgent: getClientUserAgent(request),
      });

      if (isLockout) {
        return errorResponse(
          ERROR_CODES.TOKEN_LOCKED,
          `Terlalu banyak percobaan gagal. Silakan coba lagi dalam ${LOCKOUT_MINUTES} menit.`,
          403,
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.CHALLENGE_FAILED,
            message: `Tanggal lahir tidak sesuai. Anda memiliki ${MAX_FAILED_ATTEMPTS - newAttempts} percobaan lagi.`,
            remaining_attempts: MAX_FAILED_ATTEMPTS - newAttempts,
          },
        },
        { status: 403 },
      );
    }

    // Verifikasi berhasil — reset failed_attempts
    await supabaseAdmin
      .from('client_tokens')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('id', tokenRecord.id);

    // Generate session JWT (2 jam)
    const secret = new TextEncoder().encode(
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const sessionToken = await new SignJWT({
      token_hash: tokenHash,
      client_id: clientData.id,
      verified_at: new Date().toISOString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(`${SESSION_EXPIRY_HOURS}h`)
      .sign(secret);

    const sessionExpiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Audit log
    await logAuditEvent(supabaseAdmin, {
      eventType: 'CHALLENGE_SUCCESS',
      actorType: 'client',
      resourceType: 'token',
      resourceId: tokenRecord.id,
      ipAddress: getClientIp(request),
      userAgent: getClientUserAgent(request),
    });

    // Set httpOnly cookie + return response
    const response = NextResponse.json(
      {
        success: true,
        data: {
          verified: true,
          session_token: sessionToken,
          session_expires_at: sessionExpiresAt.toISOString(),
        },
      },
      { status: 200 },
    );

    response.cookies.set('exata_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
    });

    return response;
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
}
