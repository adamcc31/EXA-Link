/**
 * Tipe database Supabase — manual definition.
 *
 * File ini mendefinisikan schema database secara manual.
 * Setelah migrasi dijalankan, regenerasi menggunakan:
 * `npx supabase gen types typescript --local > src/types/database.ts`
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'clients_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
          token_type: 'nenkin' | 'gensen';
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
          token_type?: 'nenkin' | 'gensen';
        };
        Update: {
          is_active?: boolean;
          failed_attempts?: number;
          locked_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_tokens_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_tokens_generated_by_fkey';
            columns: ['generated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          client_id: string;
          document_type: 'dattai_ichijikin' | 'resi_transfer' | 'kwitansi' | 'hagaki';
          title: string;
          description: string | null;
          uploaded_by: string;
          created_at: string;
          category: 'nenkin' | 'gensen';
          document_year: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          document_type: 'dattai_ichijikin' | 'resi_transfer' | 'kwitansi' | 'hagaki';
          title: string;
          description?: string | null;
          uploaded_by: string;
          created_at?: string;
          category?: 'nenkin' | 'gensen';
          document_year?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'document_files_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
        ];
      };
      batch_jobs: {
        Row: {
          id: string;
          client_id: string;
          document_type: 'dattai_ichijikin' | 'resi_transfer' | 'kwitansi';
          title: string;
          status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
          total_files: number;
          processed_files: number;
          failed_files: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          document_type: 'dattai_ichijikin' | 'resi_transfer' | 'kwitansi';
          title: string;
          status?: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
          total_files?: number;
          processed_files?: number;
          failed_files?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
          processed_files?: number;
          failed_files?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'batch_jobs_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'batch_jobs_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      batch_job_files: {
        Row: {
          id: string;
          batch_job_id: string;
          document_file_id: string | null;
          original_file_name: string;
          status: 'queued' | 'processing' | 'completed' | 'failed';
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_job_id: string;
          document_file_id?: string | null;
          original_file_name: string;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          document_file_id?: string | null;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'batch_job_files_batch_job_id_fkey';
            columns: ['batch_job_id'];
            isOneToOne: false;
            referencedRelation: 'batch_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      dead_letter_queue: {
        Row: {
          id: string;
          batch_job_file_id: string;
          error_message: string;
          error_details: Record<string, unknown> | null;
          status: 'pending' | 'resolved' | 'discarded';
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_job_file_id: string;
          error_message: string;
          error_details?: Record<string, unknown> | null;
          status?: 'pending' | 'resolved' | 'discarded';
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'resolved' | 'discarded';
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
      };
      rate_limits: {
        Row: {
          id: string;
          key: string;
          points: number;
          expire_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          points?: number;
          expire_at: string;
        };
        Update: {
          points?: number;
          expire_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_rate_limit: {
        Args: {
          p_key: string;
          p_window_minutes: number;
          p_limit: number;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
