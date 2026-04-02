-- ============================================================
-- EXATA Client Access — Migrasi 002: Index Strategy
-- Berdasarkan DATABASE_DESIGN.md Section 4
-- ============================================================

-- === Client search ===
CREATE INDEX idx_clients_full_name ON clients USING gin(to_tsvector('simple', full_name));
CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_clients_created_at ON clients(created_at DESC);

-- === Token lookup (by hash — primary lookup method) ===
CREATE INDEX idx_client_tokens_hash ON client_tokens(token_hash) WHERE is_active = true;
CREATE INDEX idx_client_tokens_client_id ON client_tokens(client_id);
CREATE INDEX idx_client_tokens_expires_at ON client_tokens(expires_at) WHERE is_active = true;

-- === Document queries ===
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

-- === File retention cleanup ===
CREATE INDEX idx_document_files_retention ON document_files(retention_expires_at) WHERE status = 'active';
CREATE INDEX idx_document_files_document_id ON document_files(document_id);
CREATE INDEX idx_document_files_status ON document_files(status);

-- === Batch job monitoring ===
CREATE INDEX idx_batch_jobs_client_id ON batch_jobs(client_id);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status) WHERE status NOT IN ('completed');
CREATE INDEX idx_batch_job_files_status ON batch_job_files(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_batch_job_files_batch_id ON batch_job_files(batch_job_id);

-- === Audit log queries ===
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- === Rate limiting ===
CREATE INDEX idx_rate_limits_key_window ON rate_limits(key, window_start);

-- === DLQ monitoring ===
CREATE INDEX idx_dlq_status ON dead_letter_queue(status) WHERE status = 'pending';
