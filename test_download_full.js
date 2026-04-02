const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function test() {
  console.log('Querying latest token...');
  const { data: latestToken, error: tokenError } = await supabaseAdmin
    .from('client_tokens')
    .select('id, client_id, token_hash, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !latestToken) {
    console.log('No active token found.');
    return;
  }

  const { data: clientData } = await supabaseAdmin
    .from('clients')
    .select('id, date_of_birth')
    .eq('id', latestToken.client_id)
    .single();

  if (!clientData) {
    console.log('Client data not found');
    return;
  }
  
  const { data: files } = await supabaseAdmin
    .from('document_files')
    .select('id, status, documents!inner(client_id)')
    .eq('documents.client_id', latestToken.client_id)
    .eq('status', 'active')
    .limit(1);

  if (!files || files.length === 0) {
      console.log('No files found for this client.');
      return;
  }

  const fileId = files[0].id;
  
  // WAIT! We don't have the original raw token because it's hashed in the DB!
  // We can't hit the API without the raw token.
  const { data: agentData } = await supabaseAdmin.from('users').select('id').limit(1).single();
  const agentId = agentData ? agentData.id : "00000000-0000-0000-0000-000000000000";

  console.log('Attempting to create a new token via RPC to get the raw string...');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const prefix = rawToken.substring(0, 8);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { data: clientId, error: rpcError } = await supabaseAdmin.rpc('finalize_bulk_client_upload', {
    p_client_name: "TESTING CLIENT",
    p_client_dob: clientData.date_of_birth,
    p_agent_id: agentId,
    p_batch_id: "00000000-0000-0000-0000-000000000000",
    p_files: [{"doc_type": "kwitansi", "title": "test", "file_name": "test.jpg", "original_file_name": "test.jpg", "mime_type": "image/jpeg", "file_size": 100, "storage_path": "test.jpg"}],
    p_token_hash: tokenHash,
    p_token_prefix: prefix,
    p_expires_at: expiresAt.toISOString(),
    p_ip_address: "127.0.0.1",
    p_user_agent: "Node"
  });

  if (rpcError) {
      console.error('RPC Error', rpcError);
      return;
  }
  
  // Now we have the rawToken, test the verification API!
  console.log('Hit Verify API');
  const verifyResponse = await fetch(`http://localhost:3000/api/access/${rawToken}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date_of_birth: clientData.date_of_birth })
  });
  
  const setCookie = verifyResponse.headers.get('set-cookie');
  if (!setCookie) {
      console.log('Verify Failed:', await verifyResponse.text());
      return;
  }
  
  const cookieStr = setCookie.split(';')[0];
  
  // Get the newly inserted file id
  const { data: newFiles, error: checkError } = await supabaseAdmin
      .from('document_files')
      .select('id')
      .limit(1);

  if (checkError) {
      console.error(checkError);
      return;
  }
      
  console.log('Hit Download API');
  const dlRes = await fetch(`http://localhost:3000/api/access/${rawToken}/documents/${newFiles[0].id}/download`, {
    headers: { 'Cookie': cookieStr }
  });
  
  console.log('DOWNLOAD_STATUS:', dlRes.status);
  console.log('DOWNLOAD_BODY:', await dlRes.text());
}

test();
