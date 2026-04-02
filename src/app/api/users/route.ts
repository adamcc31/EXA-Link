import { withAuth, withRole, type AuthContext } from '@/lib/api/middleware';
import { successResponse, errorResponse, ERROR_CODES } from '@/lib/api/response';
import { logAuditEvent, getClientIp, getClientUserAgent } from '@/lib/api/audit';
import { USER_ROLE } from '@/types/enums';
import { z } from 'zod/v4';

const createUserSchema = z.object({
  email: z.email('Format email tidak valid'),
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  role: z.enum(['admin', 'agent']),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[a-zA-Z]/, 'Password harus mengandung huruf')
    .regex(/\d/, 'Password harus mengandung angka'),
});

/**
 * GET /api/users — Daftar user. Admin only.
 */
export const GET = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const { data: users, error } = await ctx.supabase
        .from('users')
        .select('id, email, full_name, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil data pengguna.', 500);
      }

      // Ambil statistik per user
      const userIds = (users ?? []).map((u) => u.id);

      const { data: clientCounts } = await ctx.supabase
        .from('clients')
        .select('created_by')
        .in('created_by', userIds);

      const { data: uploadCounts } = await ctx.supabase
        .from('documents')
        .select('uploaded_by')
        .in('uploaded_by', userIds);

      const clientCountMap = new Map<string, number>();
      const uploadCountMap = new Map<string, number>();

      for (const c of clientCounts ?? []) {
        clientCountMap.set(c.created_by, (clientCountMap.get(c.created_by) ?? 0) + 1);
      }
      for (const u of uploadCounts ?? []) {
        uploadCountMap.set(u.uploaded_by, (uploadCountMap.get(u.uploaded_by) ?? 0) + 1);
      }

      const enrichedUsers = (users ?? []).map((user) => ({
        ...user,
        stats: {
          clients_count: clientCountMap.get(user.id) ?? 0,
          uploads_count: uploadCountMap.get(user.id) ?? 0,
        },
      }));

      return successResponse(enrichedUsers);
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
    }
  }),
);

/**
 * POST /api/users — Buat user baru. Admin only.
 * Menggunakan Supabase Admin API untuk create auth user.
 */
export const POST = withAuth(
  withRole([USER_ROLE.ADMIN], async (ctx: AuthContext) => {
    try {
      const body = await ctx.request.json();
      const parsed = createUserSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Data input tidak valid.', 400);
      }

      const { email, full_name, role, password } = parsed.data;

      // Buat auth user via Admin API
      const { data: authData, error: authError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        if (authError.message.includes('already registered')) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Email sudah terdaftar.', 400);
        }
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, `Gagal membuat user: ${authError.message}`, 500);
      }

      // Insert profil user ke tabel users
      const { data: user, error: profileError } = await ctx.supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          full_name,
          role,
        })
        .select('id, email, full_name, role, is_active, created_at')
        .single();

      if (profileError) {
        // Rollback: hapus auth user
        await ctx.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Gagal menyimpan profil user.', 500);
      }

      await logAuditEvent(ctx.supabaseAdmin, {
        eventType: 'USER_CREATED',
        actorType: 'admin',
        actorId: ctx.user.id,
        resourceType: 'user',
        resourceId: user!.id,
        metadata: { email, role },
        ipAddress: getClientIp(ctx.request),
        userAgent: getClientUserAgent(ctx.request),
      });

      return successResponse(user, 201);
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal.', 500);
    }
  }),
);
