import { NextResponse } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/api/middleware';
import { errorResponse, ERROR_CODES } from '@/lib/api/response';
import { createClient as createCoreClient } from '@supabase/supabase-js';
import archiver from 'archiver';

// Izinkan request panjang untuk proses download banyak file
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Mengumpulkan seluruh output dari archiver ke dalam satu Buffer.
 */
function archiveToBuffer(archive: archiver.Archiver): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err) => reject(err));
  });
}

export const GET = withAuth(async (ctx: AuthContext) => {
  try {
    if (ctx.user.role !== 'admin') {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        'Akses ditolak. Fitur ini hanya untuk Admin.',
        403,
      );
    }

    const url = new URL(ctx.request.url);
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    if (!dateFrom || !dateTo) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Tanggal date_from dan date_to wajib disertakan.',
        400,
      );
    }

    // Gunakan pure Core client (tanpa cookie SSR) agar service role key murni bypass RLS & storage policies.
    // Ini pola yang sama dengan /api/bulk-upload/upload/route.ts dan /api/access/.../download/route.ts
    const adminClient = createCoreClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1. Ambil daftar file — query terpisah untuk menghindari PostgREST inner join issue
    const { data: filesData, error } = await adminClient
      .from('document_files')
      .select('id, storage_path, file_name, document_id')
      .eq('status', 'active')
      .gte('uploaded_at', `${dateFrom}T00:00:00Z`)
      .lte('uploaded_at', `${dateTo}T23:59:59Z`);

    if (error) {
      console.error('Fetch export files error:', error);
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Gagal mengambil data dokumen dari database.',
        500,
      );
    }

    if (!filesData || filesData.length === 0) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        'Tidak ada dokumen dalam rentang tanggal tersebut.',
        404,
      );
    }

    console.log(
      `[Export ZIP] Ditemukan ${filesData.length} file untuk rentang ${dateFrom} — ${dateTo}`,
    );

    // 2. Ambil metadata dokumen (document_type, client_id) secara terpisah
    const documentIds = [...new Set(filesData.map((f) => f.document_id))];
    const { data: docsData } = await adminClient
      .from('documents')
      .select('id, document_type, client_id')
      .in('id', documentIds);

    const docsMap = new Map((docsData ?? []).map((d) => [d.id, d]));

    // 3. Ambil nama klien
    const clientIds = [...new Set((docsData ?? []).map((d) => d.client_id))];
    const { data: clientsData } = await adminClient
      .from('clients')
      .select('id, full_name')
      .in('id', clientIds);

    const clientsMap = new Map((clientsData ?? []).map((c) => [c.id, c.full_name]));

    // 4. Susun arsip ZIP menggunakan buffer approach
    const archive = archiver('zip', { zlib: { level: 5 } });
    const bufferPromise = archiveToBuffer(archive);

    // Counter untuk mengatasi nama file duplikat dalam satu folder
    const fileNameCounter = new Map<string, number>();
    let successCount = 0;
    let failCount = 0;

    for (const file of filesData) {
      const doc = docsMap.get(file.document_id);
      const clientName =
        (doc ? clientsMap.get(doc.client_id) : null)?.replace(/[^a-zA-Z0-9 ]/g, '') || 'Unknown';
      const docType = doc?.document_type || 'dokumen';
      const ext = file.storage_path.split('.').pop() || 'jpg';

      // Buat path unik di dalam zip: [NamaLengkap_Klien]/[Tipe_Dokumen].jpg
      const basePath = `${clientName}/${docType}`;
      const count = fileNameCounter.get(basePath) || 0;
      fileNameCounter.set(basePath, count + 1);
      const fileName = count === 0 ? `${docType}.${ext}` : `${docType}_${count + 1}.${ext}`;

      const { data: blob, error: dlError } = await adminClient.storage
        .from('client-documents')
        .download(file.storage_path);

      if (dlError || !blob) {
        failCount++;
        console.error(`[Export ZIP] GAGAL download: ${file.storage_path}`, dlError?.message);
        continue;
      }

      const arrayBuffer = await blob.arrayBuffer();
      archive.append(Buffer.from(arrayBuffer), { name: `${clientName}/${fileName}` });
      successCount++;
    }

    console.log(
      `[Export ZIP] Selesai: ${successCount} berhasil, ${failCount} gagal dari ${filesData.length} file`,
    );

    if (successCount === 0) {
      archive.abort();
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Semua file gagal diunduh dari storage (${failCount} file). Periksa konfigurasi bucket.`,
        500,
      );
    }

    // 5. Finalisasi arsip dan tunggu seluruh buffer selesai
    archive.finalize();
    const zipBuffer = await bufferPromise;

    console.log(`[Export ZIP] ZIP buffer size: ${zipBuffer.length} bytes`);

    // 6. Kembalikan response dengan buffer lengkap
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zipBuffer.length),
        'Content-Disposition': `attachment; filename="EXATA_Archive_${dateFrom}_to_${dateTo}.zip"`,
      },
    });
  } catch (err) {
    console.error('Export zip error:', err);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Terjadi kesalahan sistem saat mengekspor ZIP.',
      500,
    );
  }
});
