-- ============================================================
-- EXATA Client Access — Migrasi 006: Pelacakan Aktivitas Dasbor
-- ============================================================

-- 1. Tambahkan flag pelacakan pada tabel client_tokens
ALTER TABLE client_tokens 
ADD COLUMN IF NOT EXISTS has_opened BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_downloaded BOOLEAN NOT NULL DEFAULT false;

-- 2. Fungsi Trigger untuk memperbarui flag secara otomatis berdasarkan Audit Log
CREATE OR REPLACE FUNCTION update_client_token_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika client berhasil memverifikasi tanggal lahir dan membuka portal
    IF NEW.event_type = 'CHALLENGE_SUCCESS' AND NEW.resource_type = 'token' THEN
        UPDATE client_tokens 
        SET has_opened = true 
        WHERE id = NEW.resource_id;
        
    -- Jika client mengunduh sub-file dari dokumen
    ELSIF NEW.event_type = 'FILE_DOWNLOADED' AND NEW.resource_type = 'file' THEN
        -- Gunakan client_id yang telah disisipkan ke dalam kolom metadata
        IF NEW.metadata ? 'client_id' THEN
            UPDATE client_tokens
            SET has_downloaded = true
            WHERE client_id = (NEW.metadata->>'client_id')::uuid 
              AND is_active = true;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Hubungkan Trigger pada tabel audit_logs
DROP TRIGGER IF EXISTS trg_audit_logs_token_status ON audit_logs;
CREATE TRIGGER trg_audit_logs_token_status
    AFTER INSERT ON audit_logs
    FOR EACH ROW
    WHEN (NEW.event_type IN ('CHALLENGE_SUCCESS', 'FILE_DOWNLOADED'))
    EXECUTE FUNCTION update_client_token_status();
