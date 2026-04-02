import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { generateSecureToken, hashToken, getTokenPrefix, validateTokenExpiry } from '@/features/tokens/lib/crypto';
import { z } from 'zod/v4';

const generateTokenSchema = z.object({
  expires_in_days: z.number().int().min(1).max(90).optional(),
});

/**
 * POST /api/clients/[id]/tokens — Generate token baru untuk client.
 * Token lama otomatis direvoke.
 */
export const POST = withAuth(async (ctx: AuthContext) => {
  try {
    const pathParts = ctx.request.nextUrl.pathname.split('/');
    const clientId = pathParts[pathParts.indexOf('clients') + 1];

    // Validasi client exists
    const { data: client, error: clientError } = await ctx.supabase
      .from('clients')
      .select('id, full_name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Client tidak ditemukan.', 404);
    }

    // Parse body
    const body = await ctx.request.json().catch(() => ({}));
    const parsed = generateTokenSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Parameter tidak valid.', 400);
    }

    // Generate token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = getTokenPrefix(rawToken);

    let expiresAt: Date;
    try {
      expiresAt = validateTokenExpiry(parsed.data.expires_in_days);
    } catch (err) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, (err as Error).message, 400);
    }

    // Revoke semua token lama untuk client ini
    await ctx.supabase
      .from('client_tokens')
      .update({ is_active: false })
      .eq('client_id', clientId)
      .eq('is_active', true);

    // Insert token baru
    const { error: insertError } = await ctx.supabase.from('client_tokens').insert({
      client_id: clientId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      generated_by: ctx.user.id,
    });

    if (insertError) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal membuat token.', 500);
    }

    // Audit log
    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'TOKEN_GENERATED',
      actorType: ctx.user.role,
      actorId: ctx.user.id,
      resourceType: 'token',
      resourceId: clientId,
      metadata: {
        client_name: client.full_name,
        token_prefix: tokenPrefix,
        expires_at: expiresAt.toISOString(),
      },
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    // Base URL dari env atau default
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ctx.request.nextUrl.origin;

    return successResponse(
      {
        access_url: `${baseUrl}/access/${rawToken}`,
        token_prefix: tokenPrefix,
        expires_at: expiresAt.toISOString(),
        warning: 'URL ini hanya ditampilkan sekali. Simpan atau kirimkan ke client sekarang.',
      },
      201,
    );
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});

/**
 * GET /api/clients/[id]/tokens — Daftar token untuk client.
 */
export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    const pathParts = ctx.request.nextUrl.pathname.split('/');
    const clientId = pathParts[pathParts.indexOf('clients') + 1];

    const { data: tokens, error } = await ctx.supabase
      .from('client_tokens')
      .select('id, token_prefix, expires_at, is_active, failed_attempts, locked_until, generated_by, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data token.', 500);
    }

    // Enrich dengan nama generator
    const generatorIds = [...new Set((tokens ?? []).map((t) => t.generated_by))];
    const { data: generators } = await ctx.supabase
      .from('users')
      .select('id, full_name')
      .in('id', generatorIds);

    const generatorsMap = new Map((generators ?? []).map((u) => [u.id, u.full_name]));

    const enrichedTokens = (tokens ?? []).map((token) => ({
      id: token.id,
      prefix: token.token_prefix,
      expires_at: token.expires_at,
      is_active: token.is_active,
      failed_attempts: token.failed_attempts,
      locked_until: token.locked_until,
      generated_by: {
        id: token.generated_by,
        full_name: generatorsMap.get(token.generated_by) ?? 'Unknown',
      },
      created_at: token.created_at,
    }));

    return successResponse(enrichedTokens);
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
