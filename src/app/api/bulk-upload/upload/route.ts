import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { errorResponse, successResponse } from '@/lib/api/response';
import { createClient as createCoreClient } from '@supabase/supabase-js';

export const POST = withAuth(async (ctx: AuthContext) => {
  try {
    const formData = await ctx.request.formData();
    const file = formData.get('file') as File | null;
    const storagePath = formData.get('storagePath') as string;

    if (!file || !storagePath) {
      return errorResponse('VALIDATION_ERROR', 'File atau storagePath tidak ditemukan.', 400);
    }

    // Bypass RLS menggunakan supabaseAdmin murni (tanpa cookie agar JWT user tidak menimpa service role key)
    const adminClient = createCoreClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminClient.storage
      .from('client-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      return errorResponse('INTERNAL_ERROR', `Gagal mengunggah file ke Storage: ${uploadError.message}`, 500);
    }

    return successResponse({ success: true, path: storagePath });
  } catch (error: any) {
    return errorResponse('INTERNAL_ERROR', `Kesalahan server: ${error.message}`, 500);
  }
});
