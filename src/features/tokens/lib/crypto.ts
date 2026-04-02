import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate token aman menggunakan CSPRNG.
 * 32 bytes = 256 bits entropy → 64 karakter hex.
 *
 * Sesuai TOKEN_SECURITY_MODEL.md Section 1.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash token menggunakan SHA-256.
 * Token mentah tidak pernah disimpan — hanya hash-nya.
 *
 * Sesuai TOKEN_SECURITY_MODEL.md Section 3.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Ekstrak prefix 8 karakter pertama dari token.
 * Digunakan untuk display di UI tanpa mengekspos token lengkap.
 */
export function getTokenPrefix(rawToken: string): string {
  return rawToken.substring(0, 8);
}

/**
 * Validasi durasi token expiry dalam hari.
 * Sesuai TOKEN_SECURITY_MODEL.md Section 4.
 *
 * @returns Date object untuk expires_at
 */
export function validateTokenExpiry(requestedDays?: number): Date {
  const DEFAULT_DAYS = 14;
  const MIN_HOURS = 1;
  const MAX_DAYS = 90;

  const days = requestedDays ?? DEFAULT_DAYS;

  if (days * 24 < MIN_HOURS) {
    throw new Error('Token expiry minimum 1 jam');
  }
  if (days > MAX_DAYS) {
    throw new Error('Token expiry maksimum 90 hari');
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
