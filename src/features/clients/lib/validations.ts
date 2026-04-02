import { z } from 'zod/v4';

/**
 * Skema validasi untuk Client Management.
 * Berdasarkan API_SPECIFICATION.md Section 2.
 */

export const createClientSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(255, 'Nama lengkap maksimal 255 karakter'),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir harus YYYY-MM-DD')
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    }, 'Tanggal lahir harus di masa lalu'),
  phone: z.string().max(20, 'Nomor telepon maksimal 20 karakter').optional(),
  email: z.email('Format email tidak valid').optional(),
  notes: z.string().max(1000, 'Catatan maksimal 1000 karakter').optional(),
});

export const updateClientSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(255, 'Nama lengkap maksimal 255 karakter')
    .optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir harus YYYY-MM-DD')
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    }, 'Tanggal lahir harus di masa lalu')
    .optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.email('Format email tidak valid').nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const listClientsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'full_name', 'date_of_birth']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsInput = z.infer<typeof listClientsSchema>;
