const https = require('https');

const SUB_URL = 'zyahmqbdqjdklthdwiiw.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YWhtcWJkcWpka2x0aGR3aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjY1NTMsImV4cCI6MjEwNjgwMjU1M30.Xi9V9mrzavbiCmqIm9CS2KQSJrBOopNUsar_BX3Eiag';

function query(table) {
  return new Promise((resolve) => {
    const options = {
      hostname: SUB_URL,
      path: `/rest/v1/${table}?select=*&limit=5`,
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, data }); }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('=== CHECK TROLLEYS TABLE ===');
  const trolleys = await query('trolleys');
  console.log('Status:', trolleys.status);
  console.log('Data sample:', JSON.stringify(trolleys.data, null, 2));

  console.log('=== CHECK KAS8_TROLLEYS WIP ===');
  const wip = await query('wip?id=eq.kas8_trolleys');
  console.log('WIP Data:', JSON.stringify(wip.data, null, 2));
}

run();
