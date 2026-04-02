-- ============================================================
-- EXATA Client Access — Migrasi 007: RPC Dashboard Batch View
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_batches(
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 20,
    p_agent_id UUID DEFAULT NULL
)
RETURNS TABLE (
    batch_id UUID,
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
        al.created_at,
        u.full_name AS agent_name,
        COALESCE((al.metadata->>'total_clients')::INTEGER, 0) AS total_clients,
        (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', sub.client_id,
                    'full_name', sub.full_name,
                    'date_of_birth', sub.date_of_birth,
                    'document_count', sub.document_count,
                    'has_opened', sub.has_opened,
                    'has_downloaded', sub.has_downloaded
                )
            ), '[]'::jsonb)
            FROM (
                -- Distinct untuk menghindari replikasi log dari beberapa upload file pada 1 klien 
                SELECT DISTINCT 
                       c.id AS client_id, 
                       c.full_name, 
                       c.date_of_birth,
                       (SELECT COUNT(*)::INT 
                        FROM document_files df 
                        JOIN documents d ON df.document_id = d.id 
                        WHERE d.client_id = c.id AND df.status = 'active') AS document_count,
                       COALESCE(ct.has_opened, false) AS has_opened,
                       COALESCE(ct.has_downloaded, false) AS has_downloaded
                FROM audit_logs file_log
                JOIN clients c ON c.id = (file_log.metadata->>'client_id')::uuid
                LEFT JOIN client_tokens ct ON ct.client_id = c.id AND ct.is_active = true
                WHERE file_log.event_type = 'FILE_UPLOADED' 
                  AND file_log.metadata->>'batch_id' = al.id::text
            ) sub
        ) AS clients
    FROM audit_logs al
    JOIN users u ON al.actor_id = u.id
    WHERE al.event_type = 'BATCH_UPLOAD_STARTED'
      AND (p_agent_id IS NULL OR al.actor_id = p_agent_id)
    ORDER BY al.created_at DESC
    OFFSET ((p_page - 1) * p_per_page)
    LIMIT p_per_page;
END;
$$;
