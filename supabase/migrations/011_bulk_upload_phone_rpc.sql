-- ============================================================
-- EXATA Client Access — Migrasi 011: Bulk Upload Phone RPC
-- ============================================================

-- Hapus fungsi lama agar tidak bentrok
DROP FUNCTION IF EXISTS finalize_bulk_client_upload(TEXT, DATE, UUID, UUID, UUID, JSONB, TEXT, TEXT, TIMESTAMPTZ, INET, TEXT);

CREATE OR REPLACE FUNCTION finalize_bulk_client_upload(
    p_client_name TEXT,
    p_client_dob DATE,
    p_client_phone VARCHAR(50),
    p_agent_id UUID,
    p_pic_id UUID,
    p_batch_id UUID,
    p_files JSONB,
    p_token_hash TEXT,
    p_token_prefix TEXT,
    p_expires_at TIMESTAMPTZ,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_client_id UUID;
    v_document_id UUID;
    v_file RECORD;
BEGIN
    -- 1. Cari atau buat Client berdasarkan Nama dan Tanggal Lahir
    -- Pencarian case-insensitive dan trim space
    SELECT id INTO v_client_id 
    FROM clients 
    WHERE upper(trim(full_name)) = upper(trim(p_client_name)) 
      AND date_of_birth = p_client_dob 
    LIMIT 1;

    IF v_client_id IS NULL THEN
        -- Gunakan p_pic_id sebagai created_by untuk auto-assign ke PIC
        INSERT INTO clients (full_name, date_of_birth, phone, created_by)
        VALUES (trim(p_client_name), p_client_dob, p_client_phone, p_pic_id)
        RETURNING id INTO v_client_id;
        
        -- Logging: CLIENT_CREATED
        INSERT INTO audit_logs (event_type, actor_type, actor_id, resource_type, resource_id, metadata, ip_address, user_agent)
        VALUES ('CLIENT_CREATED', 'agent', p_agent_id, 'client', v_client_id, 
            jsonb_build_object('source', 'bulk_upload', 'assigned_to', p_pic_id), 
            p_ip_address, p_user_agent);
    ELSE
        -- Update the phone number if it's provided and they already exist
        IF p_client_phone IS NOT NULL AND p_client_phone != '' THEN
            UPDATE clients SET phone = p_client_phone WHERE id = v_client_id;
        END IF;
    END IF;

    -- 2. Deaktivasi token lama jika ada
    UPDATE client_tokens
    SET is_active = false
    WHERE client_id = v_client_id AND is_active = true;

    -- 3. Insert Token Baru (generated_by tetap agent_id pengunggah)
    INSERT INTO client_tokens (client_id, token_hash, token_prefix, expires_at, is_active, generated_by)
    VALUES (v_client_id, p_token_hash, p_token_prefix, p_expires_at, true, p_agent_id);

    -- Logging: TOKEN_GENERATED
    INSERT INTO audit_logs (event_type, actor_type, actor_id, resource_type, resource_id, metadata, ip_address, user_agent)
    VALUES ('TOKEN_GENERATED', 'agent', p_agent_id, 'token', v_client_id, 
        jsonb_build_object('expires_at', p_expires_at, 'prefix', p_token_prefix), 
        p_ip_address, p_user_agent);

    -- 4. Parse JSON dan Insert Documents & Files
    FOR v_file IN SELECT * FROM jsonb_to_recordset(p_files) AS x(
        doc_type TEXT,
        title TEXT,
        file_name TEXT,
        original_file_name TEXT,
        mime_type TEXT,
        file_size BIGINT,
        storage_path TEXT
    )
    LOOP
        -- Insert metadata dokumen head (diupload oleh p_agent_id)
        INSERT INTO documents (client_id, document_type, title, uploaded_by)
        VALUES (v_client_id, v_file.doc_type, v_file.title, p_agent_id)
        RETURNING id INTO v_document_id;

        -- Insert detail file fisik
        INSERT INTO document_files (document_id, file_name, original_file_name, mime_type, file_size, storage_path, status)
        VALUES (v_document_id, v_file.file_name, v_file.original_file_name, v_file.mime_type, v_file.file_size, v_file.storage_path, 'active');

        -- Logging: FILE_UPLOADED
        INSERT INTO audit_logs (event_type, actor_type, actor_id, resource_type, resource_id, metadata, ip_address, user_agent)
        VALUES ('FILE_UPLOADED', 'agent', p_agent_id, 'file', v_document_id, 
            jsonb_build_object('client_id', v_client_id, 'file_type', v_file.doc_type, 'file_size', v_file.file_size, 'batch_id', p_batch_id), 
            p_ip_address, p_user_agent);
    END LOOP;

    RETURN v_client_id;
END;
$$;
