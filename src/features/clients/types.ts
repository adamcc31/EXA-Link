/**
 * Types untuk feature Clients.
 * Akan dipopulasi di Fase 4 saat implementasi Client Management.
 */

import type { DocumentType } from '@/types/enums';

export interface Client {
  id: string;
  full_name: string;
  date_of_birth: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  document_count?: number;
  active_token?: {
    prefix: string;
    expires_at: string;
    is_active: boolean;
  } | null;
  created_by: {
    id: string;
    full_name: string;
  };
  created_at: string;
}

export interface CreateClientPayload {
  full_name: string;
  date_of_birth: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ClientDocument {
  id: string;
  document_type: DocumentType;
  title: string;
  files: ClientDocumentFile[];
  created_at: string;
}

export interface ClientDocumentFile {
  id: string;
  original_file_name: string;
  file_size: number;
  uploaded_at: string;
  status: 'active' | 'deleted';
  retention_expires_at: string;
}
