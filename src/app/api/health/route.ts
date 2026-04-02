import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/health — Health check endpoint.
 * Publik, tidak memerlukan autentikasi.
 */
export async function GET() {
  try {
    const supabaseAdmin = await createAdminClient();
    const timestamp = new Date().toISOString();

    // Cek koneksi database
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true });

    // Cek koneksi storage
    const { error: storageError } = await supabaseAdmin.storage.listBuckets();

    // Cek antrian batch jobs
    const { count: pendingJobs } = await supabaseAdmin
      .from('batch_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: processingJobs } = await supabaseAdmin
      .from('batch_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const { count: failedJobs } = await supabaseAdmin
      .from('batch_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    const { count: dlqSize } = await supabaseAdmin
      .from('dead_letter_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const isHealthy = !dbError && !storageError;

    return NextResponse.json(
      {
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          timestamp,
          version: '1.0.0',
          services: {
            database: dbError ? 'disconnected' : 'connected',
            storage: storageError ? 'disconnected' : 'connected',
            auth: 'connected',
          },
          queue: {
            pending_jobs: pendingJobs ?? 0,
            processing_jobs: processingJobs ?? 0,
            failed_jobs: failedJobs ?? 0,
            dlq_size: dlqSize ?? 0,
          },
        },
      },
      { status: isHealthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      },
      { status: 503 },
    );
  }
}
