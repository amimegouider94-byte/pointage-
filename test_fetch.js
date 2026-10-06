async function main() {
  const url = 'https://zyahmqbdqjdklthdwiiw.supabase.co/rest/v1/submissions?select=*';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YWhtcWJkcWpka2x0aGR3aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjY1NTMsImV4cCI6MjEwNjgwMjU1M30.Xi9V9mrzavbiCmqIm9CS2KQSJrBOopNUsar_BX3Eiag';
  try {
    const res = await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    const data = await res.json();
    console.log('Submissions:', JSON.stringify(data, null, 2));

    const resWip = await fetch('https://zyahmqbdqjdklthdwiiw.supabase.co/rest/v1/wip?select=*', { headers: { apikey: key, authorization: `Bearer ${key}` } });
    const dataWip = await resWip.json();
    console.log('WIP:', JSON.stringify(dataWip, null, 2));
  } catch(e) {
    console.error(e);
  }
}
main();
