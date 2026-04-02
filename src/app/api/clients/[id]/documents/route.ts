import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { z } from 'zod/v4';
import { randomUUID } from 'node:crypto';

const uploadSchema = z.object({
  document_type: z.enum(['dattai_ichijikin', 'resi_transfer', 'kwitansi']),
  title: z.string().min(3, 'Judul minimal 3 karakter').max(255, 'Judul maksimal 255 karakter'),
  description: z.string().max(1000).optional(),
});

const ALLOWED_MIME = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10_485_760; // 10 MB
const DOC_TYPE_FOLDER: Record<string, string> = {
  dattai_ichijikin: 'dattai-ichijikin',
  resi_transfer: 'resi-transfer',
  kwitansi: 'kwitansi',
};

/**
 * POST /api/clients/[id]/documents — Upload single dokumen.
 */
export const POST = withAuth(async (ctx: AuthContext) => {
  try {
    const pathParts = ctx.request.nextUrl.pathname.split('/');
    const clientId = pathParts[pathParts.indexOf('clients') + 1];

    // Validasi client exists
    const { data: client, error: clientError } = await ctx.supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(ERROR_CODES.NOT_FOUND, 'Client tidak ditemukan.', 404);
    }

    // Parse multipart form data
    const formData = await ctx.request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('document_type') as string;
    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) ?? undefined;

    // Validasi metadata
    const parsed = uploadSchema.safeParse({ document_type: documentType, title, description });
    if (!parsed.success) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Data input tidak valid.', 400);
    }

    // Validasi file
    if (!file) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'File wajib diunggah.', 400);
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return errorResponse(
        ERROR_CODES.INVALID_FILE_TYPE,
        'Tipe file tidak didukung. Gunakan JPG, JPEG, atau PNG.',
        400,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        ERROR_CODES.FILE_TOO_LARGE,
        'Ukuran file melebihi batas maksimal 10 MB.',
        400,
      );
    }

    // Generate UUID filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileUuid = randomUUID();
    const fileName = `${fileUuid}.${fileExt}`;
    const folder = DOC_TYPE_FOLDER[parsed.data.document_type];
    const storagePath = `${clientId}/${folder}/${fileName}`;

    // Upload ke Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await ctx.supabaseAdmin.storage
      .from('client-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
        metadata: {
          client_id: clientId,
          document_type: parsed.data.document_type,
          uploaded_by: ctx.user.id,
          original_name: file.name,
        },
      });

    if (uploadError) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, `Gagal mengunggah file: ${uploadError.message}`, 500);
    }

    // Insert document record
    const { data: document, error: docError } = await ctx.supabase
      .from('documents')
      .insert({
        client_id: clientId,
        document_type: parsed.data.document_type,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        uploaded_by: ctx.user.id,
      })
      .select('id, document_type, title, created_at')
      .single();

    if (docError || !document) {
      // Rollback storage upload
      await ctx.supabaseAdmin.storage.from('client-documents').remove([storagePath]);
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal menyimpan metadata dokumen.', 500);
    }

    // Insert document file record
    const retentionExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 3 bulan

    const { data: docFile, error: fileError } = await ctx.supabase
      .from('document_files')
      .insert({
        document_id: document.id,
        file_name: fileName,
        original_file_name: file.name,
        mime_type: file.type as 'image/jpeg' | 'image/png',
        file_size: file.size,
        storage_path: storagePath,
        retention_expires_at: retentionExpiresAt.toISOString(),
      })
      .select('id, original_file_name, file_size, mime_type, uploaded_at, retention_expires_at')
      .single();

    if (fileError) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal menyimpan metadata file.', 500);
    }

    // Audit log
    await logAuditEvent(ctx.supabaseAdmin, {
      eventType: 'FILE_UPLOADED',
      actorType: ctx.user.role,
      actorId: ctx.user.id,
      resourceType: 'file',
      resourceId: docFile!.id,
      metadata: {
        client_id: clientId,
        document_type: parsed.data.document_type,
        file_name: file.name,
        file_size: file.size,
      },
      ipAddress: getClientIp(ctx.request),
      userAgent: getClientUserAgent(ctx.request),
    });

    return successResponse(
      {
        document: {
          ...document,
          file: docFile,
        },
      },
      201,
    );
  } catch {
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
  }
});
