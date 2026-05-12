import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { ActorType, ResourceType, EventType } from '@/types/enums';

interface AuditLogParams {
  eventType: EventType;
  actorType: ActorType;
  actorId?: string | null;
  resourceType: ResourceType;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Mencatat event ke tabel audit_logs.
 * Menggunakan admin client untuk bypass RLS (audit logs harus selalu bisa ditulis).
 */
export async function logAuditEvent(
  supabaseAdmin: SupabaseClient<Database>,
  params: AuditLogParams,
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    event_type: params.eventType,
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? {},
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    // Audit logging seharusnya tidak menghalangi operasi utama
    // tapi kita log error-nya untuk monitoring
    console.error('Gagal mencatat audit log:', error.message, {
      eventType: params.eventType,
      resourceId: params.resourceId,
    });
  }
}

/**
 * Ekstrak IP address dari request headers.
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return request.headers.get('x-real-ip') ?? null;
}

/**
 * Ekstrak user agent dari request headers.
 */
export function getClientUserAgent(request: Request): string | null {
  return request.headers.get('user-agent') ?? null;
}
