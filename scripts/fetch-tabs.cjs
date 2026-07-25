const https = require('https');
const fs = require('fs');
const path = require('path');

const docId = '1hZ0Ex_kpQMnurOdgBrHjWUs2gxp8R0JjeLxPDR44V_g';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching pubhtml...');
  const html = await fetchUrl(`https://docs.google.com/spreadsheets/d/${docId}/pubhtml`);
  console.log('Fetched pubhtml length:', html.length);

  const tabs = [];
  const regex = /<li\s+id="sheet-button-([0-9]+)"[^>]*>\s*<a[^>]*>(.*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    tabs.push({ gid: match[1], name: match[2].replace(/<[^>]+>/g, '').trim() });
  }

  console.log('Discovered Tabs:', tabs);

  if (tabs.length === 0) {
    // Try matching sheetId in pubhtml JSON data
    const jsonRegex = /"sheetId"\s*:\s*([0-9]+)\s*,\s*"name"\s*:\s*"([^"]+)"/gi;
    while ((match = jsonRegex.exec(html)) !== null) {
      tabs.push({ gid: match[1], name: match[2].trim() });
    }
    console.log('Discovered Tabs (JSON regex):', tabs);
  }

  for (const tab of tabs) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${tab.gid}`;
    console.log(`Downloading ${tab.name} (gid ${tab.gid})...`);
    const csvData = await fetchUrl(csvUrl);

    // Sanitize filename
    const safeName = tab.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    const filename = `STUDENTS_REGISTRATION_DATABASE_${safeName}.csv`;
    const targetPath = path.join(__dirname, '..', filename);
    fs.writeFileSync(targetPath, csvData, 'utf8');
    console.log(`Saved ${filename} (${csvData.length} bytes).`);
  }
}

run().catch(console.error);
