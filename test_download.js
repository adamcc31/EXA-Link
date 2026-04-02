const http = require('http');

async function test() {
  const token = '2103cb9e0279e094a7acbb3de8a5494645a8962256ab1173042ed27adaf6912e';
  const dob = '2000-10-29'; // Assumption from earlier testing

  const verifyResponse = await fetch(`http://localhost:3000/api/access/${token}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date_of_birth: dob })
  });

  const setCookie = verifyResponse.headers.get('set-cookie');
  console.log('VERIFY_STATUS:', verifyResponse.status);
  console.log('COOKIE:', setCookie);

  if (verifyResponse.status !== 200) {
      console.log('VERIFY FAILED:', await verifyResponse.text());
      return;
  }

  const cookieStr = setCookie.split(';')[0]; // Extract exactly the cookie part
  const fileId = 'd8e5cb03-a898-4d30-b6ff-5c69aa4bff7f';

  const downloadResponse = await fetch(`http://localhost:3000/api/access/${token}/documents/${fileId}/download`, {
    headers: {
      'Cookie': cookieStr
    }
  });

  console.log('DOWNLOAD_STATUS:', downloadResponse.status);
  console.log('DOWNLOAD_BODY:', await downloadResponse.text());
}

test();
