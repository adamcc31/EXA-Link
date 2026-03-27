/**
 * Format respons standar API EXATA.
 * Berdasarkan API_SPECIFICATION.md — Konvensi Umum.
 */

/** Metadata pagination untuk respons daftar. */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
}

/** Respons sukses standar EXATA. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Detail error per-field untuk validasi. */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Respons error standar EXATA. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/** Union type untuk semua respons API. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Parameter query standar untuk endpoint daftar/list. */
export interface PaginationParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
