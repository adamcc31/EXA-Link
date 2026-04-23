import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { updateClientSchema } from '@/features/clients/lib/validations';
import { z } from 'zod/v4';
import { createClient as createCoreClient } from '@supabase/supabase-js';

/**
 * GET /api/clients/[id] — Detail client lengkap.
 */
export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    const id = ctx.request.nextUrl.pathname.split('/').pop();

    const { data: client, error } = await ctx.supabase
      .from('clients')
      .select('*')
      .eq('id', id!)
      .single();

    if (error || !client) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Client tidak ditemukan.', 404);
    }

    // Ambil dokumen + file
    const { data: documents } = await ctx.supabase
      .from('documents')
      .select(
        `
        id, document_type, title, description, created_at,
        document_files (
          id, original_file_name, file_size, mime_type, status, uploaded_at, retention_expires_at
        )
      `,
      )
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });

    // Ambil token history
    const { data: tokens } = await ctx.supabase
      .from('client_tokens')
      .select(
        'id, token_prefix, expires_at, is_active, failed_attempts, locked_until, generated_by, created_at',
      )
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });

    // Ambil nama pembuat
    const { data: creator } = await ctx.supabase
      .from('users')
      .select('id, full_name')
      .eq('id', client.created_by)
      .single();

    return successResponse({
      ...client,
      documents: (documents ?? []).map((doc) => ({
        ...doc,
        files: (doc.document_files ?? []).filter((f: { status: string }) => f.status === 'active'),
      })),
      tokens: tokens ?? [],
      created_by: creator ?? { id: client.created_by, full_name: 'Unknown' },
    });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});

/**
 * PATCH /api/clients/[id] — Update data client.
 */
export const PATCH = withAuth(async (ctx: AuthContext) => {
  try {
    const id = ctx.request.nextUrl.pathname.split('/').pop();
    const body = await ctx.request.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Data input tidak valid.', 400);
    }

    const { data: client, error } = await ctx.supabase
      .from('clients')
      .update(parsed.data)
      .eq('id', id!)
      .select('id, full_name, date_of_birth, phone, email, notes, updated_at')
      .single();

    if (error || !client) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Client tidak ditemukan.', 404);
    }

    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'CLIENT_UPDATED',
      actorType: ctx.user.role,
      actorId: ctx.user.id,
      resourceType: 'client',
      resourceId: client.id,
      metadata: { changed_fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    return successResponse(client);
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});

/**
 * DELETE /api/clients/[id] — Hapus client (admin only, cascade).
 */
export const DELETE = withAuth(async (ctx: AuthContext) => {
  try {
    if (ctx.user.role !== 'admin') {
      return errorResponse(ERROR_CODES.FORBIDDEN, 'Hanya admin yang dapat menghapus client.', 403);
    }

    const id = ctx.request.nextUrl.pathname.split('/').pop();

    // Hapus file dari Storage terlebih dahulu
    const { data: documents } = await ctx.supabase
      .from('documents')
      .select('id')
      .eq('client_id', id!);

    if (documents && documents.length > 0) {
      const docIds = documents.map((d) => d.id);
      const { data: files } = await ctx.supabase
        .from('document_files')
        .select('storage_path')
        .in('document_id', docIds);

      if (files && files.length > 0) {
        const paths = files.map((f) => f.storage_path);
        const adminClient = createCoreClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        await adminClient.storage.from('client-documents').remove(paths);
      }
    }

    const { error } = await ctx.supabase.from('clients').delete().eq('id', id!);

    if (error) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Client tidak ditemukan.', 404);
    }

    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'CLIENT_UPDATED',
      actorType: 'admin',
      actorId: ctx.user.id,
      resourceType: 'client',
      resourceId: id!,
      metadata: { action: 'deleted' },
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    return successResponse({ message: 'Client dan seluruh dokumen terkait berhasil dihapus.' });
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
