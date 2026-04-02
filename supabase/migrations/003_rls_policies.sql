-- ============================================================
-- EXATA Client Access — Migrasi 003: Row Level Security
-- Berdasarkan DATABASE_DESIGN.md Section 6
-- ============================================================

-- Aktifkan RLS pada semua tabel
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_job_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: Ambil role user dari tabel users
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Users: admin lihat semua, agent lihat diri sendiri
-- ============================================================
CREATE POLICY users_admin_all ON users FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY users_agent_select_self ON users FOR SELECT
    USING (auth.uid() = id);

-- ============================================================
-- Clients: admin lihat semua, agent lihat client miliknya
-- ============================================================
CREATE POLICY clients_admin_all ON clients FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY clients_agent_select ON clients FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY clients_agent_insert ON clients FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY clients_agent_update ON clients FOR UPDATE
    USING (created_by = auth.uid());

-- ============================================================
-- Client Tokens: mengikuti akses client
-- ============================================================
CREATE POLICY tokens_admin_all ON client_tokens FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY tokens_agent_select ON client_tokens FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM clients WHERE clients.id = client_tokens.client_id AND clients.created_by = auth.uid()
    ));

CREATE POLICY tokens_agent_insert ON client_tokens FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM clients WHERE clients.id = client_tokens.client_id AND clients.created_by = auth.uid()
    ));

CREATE POLICY tokens_agent_update ON client_tokens FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM clients WHERE clients.id = client_tokens.client_id AND clients.created_by = auth.uid()
    ));

-- ============================================================
-- Documents: mengikuti akses client
-- ============================================================
CREATE POLICY documents_admin_all ON documents FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY documents_agent_select ON documents FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM clients WHERE clients.id = documents.client_id AND clients.created_by = auth.uid()
    ));

CREATE POLICY documents_agent_insert ON documents FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM clients WHERE clients.id = documents.client_id AND clients.created_by = auth.uid()
    ));

-- ============================================================
-- Document Files: mengikuti akses document → client
-- ============================================================
CREATE POLICY files_admin_all ON document_files FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY files_agent_select ON document_files FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM documents d
        JOIN clients c ON c.id = d.client_id
        WHERE d.id = document_files.document_id AND c.created_by = auth.uid()
    ));

CREATE POLICY files_agent_insert ON document_files FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM documents d
        JOIN clients c ON c.id = d.client_id
        WHERE d.id = document_files.document_id AND c.created_by = auth.uid()
    ));

-- ============================================================
-- Batch Jobs: mengikuti akses client
-- ============================================================
CREATE POLICY batch_jobs_admin_all ON batch_jobs FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY batch_jobs_agent_own ON batch_jobs FOR ALL
    USING (agent_id = auth.uid());

-- ============================================================
-- Batch Job Files: mengikuti akses batch job
-- ============================================================
CREATE POLICY batch_files_admin_all ON batch_job_files FOR ALL
    USING (get_user_role() = 'admin');

CREATE POLICY batch_files_agent_own ON batch_job_files FOR ALL
    USING (EXISTS (
        SELECT 1 FROM batch_jobs WHERE batch_jobs.id = batch_job_files.batch_job_id AND batch_jobs.agent_id = auth.uid()
    ));

-- ============================================================
-- Dead Letter Queue: admin only
-- ============================================================
CREATE POLICY dlq_admin_all ON dead_letter_queue FOR ALL
    USING (get_user_role() = 'admin');

-- ============================================================
-- Audit Logs: append-only, admin read-only
-- Tidak ada UPDATE atau DELETE policy = denied by default
-- ============================================================
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY audit_logs_admin_read ON audit_logs FOR SELECT
    USING (get_user_role() = 'admin');

-- ============================================================
-- Rate Limits: service role only (bypass RLS)
-- Insert/update dilakukan via service role key
-- ============================================================
CREATE POLICY rate_limits_service ON rate_limits FOR ALL
    USING (true)
    WITH CHECK (true);
