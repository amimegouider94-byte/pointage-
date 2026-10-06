const https = require('https');

const SUB_URL = 'zyahmqbdqjdklthdwiiw.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YWhtcWJkcWpka2x0aGR3aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjY1NTMsImV4cCI6MjEwNjgwMjU1M30.Xi9V9mrzavbiCmqIm9CS2KQSJrBOopNUsar_BX3Eiag';

function query(table) {
  return new Promise((resolve) => {
    const options = {
      hostname: SUB_URL,
      path: `/rest/v1/${table}?select=*`,
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('=== SUBMISSIONS ===');
  const subs = await query('submissions');
  console.log(JSON.stringify(subs, null, 2));

  console.log('=== WIP ===');
  const wips = await query('wip');
  console.log(JSON.stringify(wips, null, 2));

  console.log('=== SETTINGS ===');
  const settings = await query('settings');
  console.log(JSON.stringify(settings, null, 2));
}

run();
