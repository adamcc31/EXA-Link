import { z } from 'zod/v4';

/**
 * Skema validasi untuk environment variables.
 * Aplikasi akan gagal dimulai jika variabel yang diperlukan tidak ada.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url('NEXT_PUBLIC_SUPABASE_URL harus berupa URL yang valid'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validasi environment variables saat runtime.
 * Melempar error deskriptif jika ada variabel yang hilang atau tidak valid.
 */
function validateEnv(): Env {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const errorMessages = z.prettifyError(parsed.error);
    console.error('❌ Konfigurasi environment tidak valid:\n', errorMessages);
    throw new Error('Variabel environment tidak valid. Periksa file .env.local Anda.');
  }

  return parsed.data;
}

export const env = validateEnv();
