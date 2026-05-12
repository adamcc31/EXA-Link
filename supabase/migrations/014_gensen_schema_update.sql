-- ============================================================
-- EXATA Client Access — Migrasi 014: Dukungan Gensen
-- Menambahkan kolom untuk isolasi tipe token dan kategori dokumen
-- ============================================================

-- 1. Tambahkan token_type ke client_tokens
ALTER TABLE client_tokens 
ADD COLUMN IF NOT EXISTS token_type TEXT NOT NULL DEFAULT 'nenkin' 
CHECK (token_type IN ('nenkin', 'gensen'));

-- 2. Tambahkan kategori dan tahun ke documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'nenkin'
CHECK (category IN ('nenkin', 'gensen')),
ADD COLUMN IF NOT EXISTS document_year TEXT; -- Bisa berisi "2025" atau "5A"

-- 3. Update check constraint document_type untuk hagaki
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check 
CHECK (document_type IN ('dattai_ichijikin', 'resi_transfer', 'kwitansi', 'hagaki'));

-- 4. Tambahkan index untuk optimasi filter kategori
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_client_tokens_type ON client_tokens(token_type);
