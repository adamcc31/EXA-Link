/**
 * Types untuk feature Documents.
 * Akan dipopulasi di Fase 3–4 saat implementasi upload.
 */

import type { DocumentType } from '@/types/enums';

export interface UploadDocumentPayload {
  client_id: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  file: File;
}

export interface BatchUploadPayload {
  client_id: string;
  document_type: DocumentType;
  title_prefix: string;
  files: File[];
}

export interface BatchStatus {
  id: string;
  client_id: string;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  total_files: number;
  completed_files: number;
  failed_files: number;
  progress_percent: number;
}
