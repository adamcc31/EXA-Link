-- ============================================================
-- EXATA Client Access — Migrasi 004: Database Functions
-- ============================================================

-- ============================================================
-- 1. Rate Limiting: Check & Increment
-- ============================================================
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_window_minutes INTEGER,
    p_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, remaining INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count INTEGER;
BEGIN
    v_window_start := date_trunc('minute', NOW()) -
        ((EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes) * INTERVAL '1 minute');

    -- Upsert: increment counter atau buat baru
    INSERT INTO rate_limits (key, window_start, request_count)
    VALUES (p_key, v_window_start, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET request_count = rate_limits.request_count + 1
    RETURNING rate_limits.request_count INTO v_count;

    RETURN QUERY SELECT
        v_count <= p_limit,
        v_count,
        GREATEST(p_limit - v_count, 0);
END;
$$;

-- ============================================================
-- 2. Cleanup Expired Files (Soft Delete)
-- Dijalankan oleh pg_cron setiap hari jam 02:00 WIB
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    expired_file RECORD;
    count INTEGER := 0;
BEGIN
    FOR expired_file IN
        SELECT df.id, df.storage_path, df.document_id
        FROM document_files df
        WHERE df.status = 'active'
          AND df.retention_expires_at <= NOW()
        ORDER BY df.retention_expires_at ASC
        LIMIT 100
    LOOP
        -- Update status di database (soft delete)
        UPDATE document_files
        SET status = 'deleted', deleted_at = NOW()
        WHERE id = expired_file.id;

        -- Catat di audit log
        INSERT INTO audit_logs (event_type, actor_type, resource_type, resource_id, metadata)
        VALUES (
            'FILE_DELETED',
            'system',
            'file',
            expired_file.id,
            jsonb_build_object(
                'reason', 'retention_expired',
                'storage_path', expired_file.storage_path
            )
        );

        count := count + 1;
    END LOOP;

    RETURN QUERY SELECT count;
END;
$$;

-- ============================================================
-- 3. Cleanup Expired Tokens
-- Deaktivasi token yang sudah expired > 30 hari
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS TABLE(deactivated_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    count INTEGER := 0;
BEGIN
    UPDATE client_tokens
    SET is_active = false
    WHERE is_active = true
      AND expires_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS count = ROW_COUNT;

    IF count > 0 THEN
        INSERT INTO audit_logs (event_type, actor_type, resource_type, resource_id, metadata)
        VALUES (
            'TOKEN_REVOKED',
            'system',
            'token',
            NULL,
            jsonb_build_object('reason', 'expired_cleanup', 'count', count)
        );
    END IF;

    RETURN QUERY SELECT count;
END;
$$;

-- ============================================================
-- 4. Cleanup Rate Limits (Hapus entri lama)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- ============================================================
-- 5. pg_cron Schedules (jalankan manual jika pg_cron belum aktif)
-- ============================================================
-- Uncomment baris berikut setelah mengaktifkan pg_cron extension:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule('file-retention-cleanup', '0 19 * * *',
--     $$ SELECT cleanup_expired_files(); $$
-- );
--
-- SELECT cron.schedule('token-cleanup', '0 20 * * *',
--     $$ SELECT cleanup_expired_tokens(); $$
-- );
--
-- SELECT cron.schedule('rate-limit-cleanup', '*/15 * * * *',
--     $$ SELECT cleanup_rate_limits(); $$
-- );
