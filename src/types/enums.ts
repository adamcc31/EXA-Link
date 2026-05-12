/**
 * Enum dan konstanta yang digunakan di seluruh aplikasi.
 * Berdasarkan DATABASE_DESIGN.md dan PRD.md.
 */

/** Peran pengguna internal. */
export const USER_ROLE = {
  ADMIN: 'admin',
  AGENT: 'agent',
} as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/** Tipe dokumen yang didukung. */
export const DOCUMENT_TYPE = {
  DATTAI_ICHIJIKIN: 'dattai_ichijikin',
  RESI_TRANSFER: 'resi_transfer',
  KWITANSI: 'kwitansi',
  HAGAKI: 'hagaki',
} as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE];

/** Label tampilan untuk tipe dokumen (Bahasa Indonesia). */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  dattai_ichijikin: 'Dattai Ichijikin',
  resi_transfer: 'Resi Transfer',
  kwitansi: 'Kwitansi',
  hagaki: 'Hagaki',
};

/** Status file di storage. */
export const FILE_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;
export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

/** Status batch job. */
export const BATCH_JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;
export type BatchJobStatus = (typeof BATCH_JOB_STATUS)[keyof typeof BATCH_JOB_STATUS];

/** Status file dalam batch job. */
export const BATCH_JOB_FILE_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type BatchJobFileStatus = (typeof BATCH_JOB_FILE_STATUS)[keyof typeof BATCH_JOB_FILE_STATUS];

/** Status Dead Letter Queue. */
export const DLQ_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  DISCARDED: 'discarded',
} as const;
export type DlqStatus = (typeof DLQ_STATUS)[keyof typeof DLQ_STATUS];

/** Tipe aktor untuk audit log. */
export const ACTOR_TYPE = {
  CLIENT: 'client',
  AGENT: 'agent',
  ADMIN: 'admin',
  SYSTEM: 'system',
} as const;
export type ActorType = (typeof ACTOR_TYPE)[keyof typeof ACTOR_TYPE];

/** Tipe resource untuk audit log. */
export const RESOURCE_TYPE = {
  CLIENT: 'client',
  FILE: 'file',
  TOKEN: 'token',
  USER: 'user',
  BATCH: 'batch',
  SYSTEM: 'system',
} as const;
export type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE];

/** Tipe event untuk audit log. */
export const EVENT_TYPE = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CREATED: 'USER_CREATED',
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  TOKEN_GENERATED: 'TOKEN_GENERATED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  FILE_UPLOADED: 'FILE_UPLOADED',
  BATCH_STARTED: 'BATCH_STARTED',
  BATCH_COMPLETED: 'BATCH_COMPLETED',
  LINK_ACCESSED: 'LINK_ACCESSED',
  CHALLENGE_SUCCESS: 'CHALLENGE_SUCCESS',
  CHALLENGE_FAILED: 'CHALLENGE_FAILED',
  CHALLENGE_LOCKOUT: 'CHALLENGE_LOCKOUT',
  FILE_DOWNLOADED: 'FILE_DOWNLOADED',
  FILE_DELETED: 'FILE_DELETED',
  BATCH_DELETED: 'BATCH_DELETED',
  DATA_EXPORTED: 'DATA_EXPORTED',
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

/** MIME types yang diizinkan untuk upload. */
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Batas ukuran file maksimum (10 MB dalam bytes). */
export const MAX_FILE_SIZE_BYTES = 10_485_760;

/** Batas file per batch. */
export const MAX_BATCH_FILES = 50;

/** Durasi signed URL dalam detik (5 menit). */
export const SIGNED_URL_EXPIRY_SECONDS = 300;

/** Durasi default token dalam hari. */
export const DEFAULT_TOKEN_EXPIRY_DAYS = 14;

/** Durasi maksimal token dalam hari. */
export const MAX_TOKEN_EXPIRY_DAYS = 90;

/** Jumlah maksimal percobaan challenge sebelum lockout. */
export const MAX_CHALLENGE_ATTEMPTS = 5;

/** Durasi lockout challenge dalam menit. */
export const CHALLENGE_LOCKOUT_MINUTES = 30;

/** Durasi retensi file dalam bulan. */
export const FILE_RETENTION_MONTHS = 3;
