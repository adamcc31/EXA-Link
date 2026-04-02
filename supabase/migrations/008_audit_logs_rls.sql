-- ============================================================
-- EXATA Client Access — Migrasi 008: RLS untuk Pelacakan Aktivitas Agen
-- ============================================================

-- Tambahkan policy agar Agen dapat membaca log aktivitas diri mereka sendiri 
-- maupun aktivitas yang dilakukan oleh klien yang mereka tangani.
CREATE POLICY audit_logs_agent_select ON audit_logs FOR SELECT
    USING (
        actor_id = auth.uid() 
        OR 
        (
            metadata ? 'client_id' 
            AND 
            (metadata->>'client_id')::uuid IN (SELECT id FROM clients WHERE created_by = auth.uid())
        )
    );
