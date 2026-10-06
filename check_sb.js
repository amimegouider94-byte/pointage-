const https = require('https');

const options = {
  hostname: 'zyahmqbdqjdklthdwiiw.supabase.co',
  path: '/rest/v1/submissions?select=*',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YWhtcWJkcWpka2x0aGR3aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjY1NTMsImV4cCI6MjEwNjgwMjU1M30.Xi9V9mrzavbiCmqIm9CS2KQSJrBOopNUsar_BX3Eiag',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YWhtcWJkcWpka2x0aGR3aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjY1NTMsImV4cCI6MjEwNjgwMjU1M30.Xi9V9mrzavbiCmqIm9CS2KQSJrBOopNUsar_BX3Eiag'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Submissions:', data));
});

const options2 = {
  hostname: 'zyahmqbdqjdklthdwiiw.supabase.co',
  path: '/rest/v1/wip?select=*',
  headers: options.headers
};
https.get(options2, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('WIP:', data));
});
