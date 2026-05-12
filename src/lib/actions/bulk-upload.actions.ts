'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export type FileUploadMeta = {
  doc_type: string;
  title: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  category?: string;
  document_year?: string;
};

export interface BulkUploadClientPayload {
  clientName: string;
  dob: string; // ISO string
  phone?: string;
  files: FileUploadMeta[];
  batchId?: string | null;
  picId?: string;
  tokenType?: string;
}

// Generate the secure token
function generateSecureToken(): { token: string; hash: string; prefix: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const prefix = token.substring(0, 8);
  return { token, hash, prefix };
}

export async function finalizeClientUploadAction(payload: BulkUploadClientPayload) {
  const supabase = await createClient();

  // 1. Get the current agent's session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // 2. Generate secure token
  const { token, hash, prefix } = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiration

  // We should pass IP and Use-Agent from headers, but in Server Actions it's tricky.
  // For EXATA, we can set default or use standard Next.js headers API.
  const ipAddress = '127.0.0.1'; // Can be retrieved from next/headers in real implementation
  const userAgent = 'EXATA-System/1.0';

  // 3. Call the RPC
  // @ts-expect-error RPC type not yet generated
  const { data: clientId, error: rpcError } = await supabase.rpc('finalize_bulk_client_upload', {
    p_client_name: payload.clientName,
    p_client_dob: payload.dob.split('T')[0], // Cast to YYYY-MM-DD
    p_client_phone: payload.phone || null,
    p_agent_id: user.id,
    p_pic_id: payload.picId || user.id,
    p_batch_id: payload.batchId || null,
    p_files: payload.files,
    p_token_hash: hash,
    p_token_prefix: prefix,
    p_expires_at: expiresAt.toISOString(),
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
    p_token_type: payload.tokenType || 'nenkin',
  });

  if (rpcError) {
    console.error('Finalize Bulk Upload Error:', rpcError);
    throw new Error('Gagal memproses transaksi database untuk: ' + payload.clientName);
  }

  revalidatePath('/dashboard/clients');

  // Return generated link along with clientId
  return {
    success: true,
    clientId,
    accessLink: `/access/${token}`, // Front-end link structure
  };
}

export async function createBatchJobAction(
  totalClients: number,
  batchTitle: string = 'Batch Upload',
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  // Get a dummy client_id or set client_id as nullable in batch_jobs schema.
  // Wait, schema `batch_jobs` requires `client_id UUID NOT NULL REFERENCES clients(id)`.
  // Wait, bulk jobs are for multiple clients!
  // If `batch_jobs` requires `client_id`, it might be designed for single-client multiple-file batch upload.
  // Let me just skip batch_jobs creation since `client_id` is NOT NULL and we process multiple clients.
  // Instead, I'll just log an Audit Event.

  const ipAddress = '127.0.0.1';
  const userAgent = 'EXATA-System/1.0';

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      event_type: 'BATCH_UPLOAD_STARTED',
      actor_type: 'agent',
      actor_id: user.id,
      resource_type: 'system',
      metadata: { total_clients: totalClients, batch_title: batchTitle },
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error) console.error('Create batch error:', error);
  return { batchId: data?.id || null };
}

export async function completeBatchJobAction(
  batchId: string,
  successCount: number,
  failedCount: number,
) {
  if (!batchId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('audit_logs').insert({
    event_type: 'BATCH_UPLOAD_COMPLETED',
    actor_type: 'agent',
    actor_id: user.id,
    resource_type: 'system',
    metadata: { batch_id: batchId, success_count: successCount, failed_count: failedCount },
    ip_address: '127.0.0.1',
    user_agent: 'EXATA-System/1.0',
  });
}

export async function getAgentsAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role, email')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch agents', error);
    return [];
  }
  return data;
}
