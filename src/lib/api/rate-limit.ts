import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  remaining: number;
}

/**
 * Memeriksa rate limit menggunakan database-backed sliding window.
 * Menggunakan function check_rate_limit() di PostgreSQL.
 *
 * @param supabaseAdmin - Admin client (bypass RLS)
 * @param key - Identifier unik (format: "ip:{address}" atau "user:{id}")
 * @param windowMinutes - Durasi window dalam menit
 * @param limit - Jumlah request maksimal per window
 */
export async function checkRateLimit(
  supabaseAdmin: SupabaseClient<Database>,
  key: string,
  windowMinutes: number,
  limit: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key,
    p_window_minutes: windowMinutes,
    p_limit: limit,
  });

  if (error) {
    // Jika rate limiting gagal, izinkan request (fail-open)
    // tapi log error untuk monitoring
    console.error('Rate limit check gagal:', error.message);
    return { allowed: true, currentCount: 0, remaining: limit };
  }

  const result = data as unknown as Array<{
    allowed: boolean;
    current_count: number;
    remaining: number;
  }>;

  if (!result || result.length === 0) {
    return { allowed: true, currentCount: 0, remaining: limit };
  }

  return {
    allowed: result[0].allowed,
    currentCount: result[0].current_count,
    remaining: result[0].remaining,
  };
}

/**
 * Membuat headers rate limit standar.
 */
export function rateLimitHeaders(
  limit: number,
  remaining: number,
  windowMinutes: number,
): Record<string, string> {
  const resetTimestamp = Math.ceil(Date.now() / 1000) + windowMinutes * 60;
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(remaining, 0)),
    'X-RateLimit-Reset': String(resetTimestamp),
  };
}
