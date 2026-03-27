/**
 * Tipe database Supabase — placeholder.
 *
 * File ini akan di-generate ulang secara otomatis pada Fase 2
 * menggunakan Supabase CLI: `npx supabase gen types typescript`
 *
 * Untuk saat ini, definisi minimal disediakan agar import berfungsi.
 */

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'agent';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: 'admin' | 'agent';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'admin' | 'agent';
          is_active?: boolean;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          full_name: string;
          date_of_birth: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          date_of_birth: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          date_of_birth?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      client_tokens: {
        Row: {
          id: string;
          client_id: string;
          token_hash: string;
          token_prefix: string;
          expires_at: string;
          is_active: boolean;
          failed_attempts: number;
          locked_until: string | null;
          generated_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          token_hash: string;
          token_prefix: string;
          expires_at: string;
          is_active?: boolean;
          failed_attempts?: number;
          locked_until?: string | null;
          generated_by: string;
          created_at?: string;
        };
        Update: {
          is_active?: boolean;
          failed_attempts?: number;
          locked_until?: string | null;
        };
      };
      documents: {
        Row: {
          id: string;
          client_id: string;
          document_type: 'dattai_ichijikin' | 'resi_transfer' | 'kwitansi';
          title: string;
          description: string | null;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          document_type: 'dattai_ichijikin' | 'resi_transfer' | 'kwitansi';
          title: string;
          description?: string | null;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
        };
      };
      document_files: {
        Row: {
          id: string;
          document_id: string;
          file_name: string;
          original_file_name: string;
          mime_type: 'image/jpeg' | 'image/png';
          file_size: number;
          storage_path: string;
          status: 'active' | 'deleted';
          uploaded_at: string;
          deleted_at: string | null;
          retention_expires_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          file_name: string;
          original_file_name: string;
          mime_type: 'image/jpeg' | 'image/png';
          file_size: number;
          storage_path: string;
          status?: 'active' | 'deleted';
          uploaded_at?: string;
          deleted_at?: string | null;
          retention_expires_at?: string;
        };
        Update: {
          status?: 'active' | 'deleted';
          deleted_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          event_type: string;
          actor_type: 'client' | 'agent' | 'admin' | 'system';
          actor_id: string | null;
          resource_type: 'client' | 'file' | 'token' | 'user' | 'batch' | 'system';
          resource_id: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          actor_type: 'client' | 'agent' | 'admin' | 'system';
          actor_id?: string | null;
          resource_type: 'client' | 'file' | 'token' | 'user' | 'batch' | 'system';
          resource_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
