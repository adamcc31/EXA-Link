import { NextResponse } from 'next/server';
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiErrorDetail,
  PaginationMeta,
} from '@/types/api';

/**
 * Membuat respons sukses standar EXATA.
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true as const, data }, { status });
}

/**
 * Membuat respons sukses dengan pagination metadata.
 */
export function paginatedResponse<T>(
  data: T,
  meta: PaginationMeta,
  status: number = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true as const, data, meta }, { status });
}

/**
 * Membuat respons error standar EXATA.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: ApiErrorDetail[],
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false as const,
    error: { code, message },
  };

  if (details && details.length > 0) {
    body.error.details = details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Kode error standar yang digunakan di seluruh API.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_LOCKED: 'TOKEN_LOCKED',
  CHALLENGE_FAILED: 'CHALLENGE_FAILED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
} as const;
