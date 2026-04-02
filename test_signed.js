const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const fileId = 'd8e5cb03-a898-4d30-b6ff-5c69aa4bff7f';

  const { data: fileRecord, error: dbError } = await supabaseAdmin
    .from('document_files')
    .select('id, storage_path, original_file_name, file_size')
    .eq('id', fileId)
    .single();

  if (dbError) {
    console.error('DB_ERROR', dbError);
    return;
  }
  
  console.log('FILE_RECORD', fileRecord);

  const { data, error } = await supabaseAdmin.storage
    .from('client-documents')
    .createSignedUrl(fileRecord.storage_path, 300, {
      download: fileRecord.original_file_name,
    });

  if (error) {
    console.error('STORAGE_ERROR', error);
  } else {
    console.log('SIGNED_URL_SUCCESS', data);
  }
}

test();
