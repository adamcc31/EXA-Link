-- ============================================================
-- EXATA Client Access — Migrasi 013: Fix Token Data di Batch Dashboard
-- Menambahkan field token lengkap (is_active, expires_at, token_prefix)
-- ke JSONB output per-client agar status dan token badge tampil benar.
-- ============================================================

DROP FUNCTION IF EXISTS get_dashboard_batches(INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS get_dashboard_batches(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_dashboard_batches(
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 20,
    p_agent_id UUID DEFAULT NULL
)
RETURNS TABLE (
    batch_id UUID,
    batch_title TEXT,
    created_at TIMESTAMPTZ,
    agent_name TEXT,
    total_clients INTEGER,
    clients JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id AS batch_id,
        COALESCE(al.metadata->>'batch_title', 'Batch Upload ' || to_char(al.created_at, 'YYYY-MM-DD')) AS batch_title,
        al.created_at,
        u.full_name AS agent_name,
        COALESCE((al.metadata->>'total_clients')::INTEGER, 0) AS total_clients,
        (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', sub.client_id,
                    'full_name', sub.full_name,
                    'date_of_birth', sub.date_of_birth,
                    'phone', sub.phone,
                    'pic_name', sub.pic_name,
                    'document_count', sub.document_count,
                    'has_opened', sub.has_opened,
                    'has_downloaded', sub.has_downloaded,
                    'is_active', sub.token_is_active,
                    'token_prefix', sub.token_prefix,
                    'expires_at', sub.token_expires_at
                )
            ), '[]'::jsonb)
            FROM (
                SELECT DISTINCT 
                       c.id AS client_id, 
                       c.full_name, 
                       c.date_of_birth,
                       c.phone,
                       u_pic.full_name AS pic_name,
                       (SELECT COUNT(*)::INT 
                        FROM document_files df 
                        JOIN documents d ON df.document_id = d.id 
                        WHERE d.client_id = c.id AND df.status = 'active') AS document_count,
                       COALESCE(ct.has_opened, false) AS has_opened,
                       COALESCE(ct.has_downloaded, false) AS has_downloaded,
                       COALESCE(ct.is_active, false) AS token_is_active,
                       ct.token_prefix AS token_prefix,
                       ct.expires_at AS token_expires_at
                FROM audit_logs file_log
                JOIN clients c ON c.id = (file_log.metadata->>'client_id')::uuid
                LEFT JOIN users u_pic ON c.created_by = u_pic.id
                LEFT JOIN client_tokens ct ON ct.client_id = c.id AND ct.is_active = true
                WHERE file_log.event_type = 'FILE_UPLOADED' 
                  AND file_log.metadata->>'batch_id' = al.id::text
                  AND (p_agent_id IS NULL OR c.created_by = p_agent_id)
            ) sub
        ) AS clients
    FROM audit_logs al
    JOIN users u ON al.actor_id = u.id
    WHERE al.event_type = 'BATCH_UPLOAD_STARTED'
      AND (p_agent_id IS NULL OR EXISTS (
          SELECT 1 FROM audit_logs fl
          JOIN clients fc ON fc.id = (fl.metadata->>'client_id')::uuid
          WHERE fl.event_type = 'FILE_UPLOADED'
            AND fl.metadata->>'batch_id' = al.id::text
            AND fc.created_by = p_agent_id
      ))
    ORDER BY al.created_at DESC
    OFFSET ((p_page - 1) * p_per_page)
    LIMIT p_per_page;
END;
$$;
