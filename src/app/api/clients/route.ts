import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, paginatedResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { createClientSchema, listClientsSchema } from '@/features/clients/lib/validations';
import { z } from 'zod/v4';

/**
 * GET /api/clients — Daftar client dengan pagination dan pencarian.
 */
export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    const url = new URL(ctx.request.url);
    const params = listClientsSchema.parse({
      page: url.searchParams.get('page'),
      per_page: url.searchParams.get('per_page'),
      search: url.searchParams.get('search') ?? undefined,
      sort_by: url.searchParams.get('sort_by') ?? undefined,
      sort_order: url.searchParams.get('sort_order') ?? undefined,
    });

    const { page, per_page, search, sort_by, sort_order } = params;
    const offset = (page - 1) * per_page;

    let query = ctx.supabase
      .from('clients')
      .select('id, full_name, date_of_birth, phone, email, created_by, created_at', {
        count: 'exact',
      });

    // Role and Agent filter
    const requestedAgentId = url.searchParams.get('agent_id');
    if (ctx.user.role === 'admin') {
      if (requestedAgentId) query = query.eq('created_by', requestedAgentId);
    } else {
      query = query.eq('created_by', ctx.user.id);
    }

    // Filter pencarian berdasarkan nama
    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    // Sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Pagination
    query = query.range(offset, offset + per_page - 1);

    const { data: clients, count, error } = await query;

    if (error) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data client.', 500);
    }

    // Ambil data tambahan: document count dan active token per client
    const clientIds = (clients ?? []).map((c) => c.id);

    // Ambil jumlah dokumen per client
    const { data: docCounts } = await ctx.supabase
      .from('document_files')
      .select('document_id, documents!inner(client_id)')
      .in('documents.client_id', clientIds)
      .eq('status', 'active');

    // Ambil active token per client
    const { data: activeTokens } = await ctx.supabase
      .from('client_tokens')
      .select('client_id, token_prefix, expires_at, is_active, has_opened, has_downloaded')
      .in('client_id', clientIds)
      .eq('is_active', true);

    interface TokenRow {
      client_id: string;
      token_prefix: string;
      expires_at: string;
      is_active: boolean;
      has_opened: boolean;
      has_downloaded: boolean;
    }

    // Ambil nama pembuat
    const creatorIds = [...new Set((clients ?? []).map((c) => c.created_by))];
    const { data: creators } = await ctx.supabase
      .from('users')
      .select('id, full_name')
      .in('id', creatorIds);

    interface TokenData {
      prefix: string;
      expires_at: string;
      is_active: boolean;
      has_opened: boolean;
      has_downloaded: boolean;
    }

    const creatorsMap = new Map((creators ?? []).map((u) => [u.id, u.full_name]));
    const tokensMap = new Map<string, TokenData>(
      ((activeTokens as unknown as TokenRow[]) ?? []).map((t) => [
        t.client_id,
        {
          prefix: t.token_prefix,
          expires_at: t.expires_at,
          is_active: t.is_active,
          has_opened: t.has_opened,
          has_downloaded: t.has_downloaded,
        },
      ]),
    );

    const enrichedClients = (clients ?? []).map((client) => ({
      ...client,
      document_count: (docCounts ?? []).filter(
        (d) => (d.documents as unknown as { client_id: string })?.client_id === client.id,
      ).length,
      active_token: tokensMap.get(client.id) ?? null,
      created_by: {
        id: client.created_by,
        full_name: creatorsMap.get(client.created_by) ?? 'Unknown',
      },
    }));

    return paginatedResponse(enrichedClients, {
      page,
      per_page,
      total: count ?? 0,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Parameter tidak valid.', 400);
    }
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});

/**
 * POST /api/clients — Buat client baru.
 */
export const POST = withAuth(async (ctx: AuthContext) => {
  try {
    const body = await ctx.request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      const details = z.prettifyError(parsed.error);
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Data input tidak valid.', 400, [
        { field: 'body', message: String(details) },
      ]);
    }

    const { full_name, date_of_birth, phone, email, notes } = parsed.data;

    const { data: client, error } = await ctx.supabase
      .from('clients')
      .insert({
        full_name,
        date_of_birth,
        phone: phone ?? null,
        email: email ?? null,
        notes: notes ?? null,
        created_by: ctx.user.id,
      })
      .select('id, full_name, date_of_birth, created_at')
      .single();

    if (error) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal membuat client baru.', 500);
    }

    // Audit log
    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'CLIENT_CREATED',
      actorType: ctx.user.role,
      actorId: ctx.user.id,
      resourceType: 'client',
      resourceId: client.id,
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    return successResponse(client, 201);
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
