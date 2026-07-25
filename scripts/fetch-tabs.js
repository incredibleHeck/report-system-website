const https = require('https');
const fs = require('fs');
const path = require('path');

const docId = '1hZ0Ex_kpQMnurOdgBrHjWUs2gxp8R0JjeLxPDR44V_g';
const htmlUrl = `https://docs.google.com/spreadsheets/d/${docId}/htmlview`;

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
  console.log('Fetching Google Sheet HTML...');
  const html = await fetchUrl(htmlUrl);
  console.log('Fetched HTML length:', html.length);

  // Extract sheet tab names and gids
  const tabs = [];
  const regex = /id="sheet-button-([0-9]+)"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    tabs.push({ gid: match[1], name: match[2].trim() });
  }

  if (tabs.length === 0) {
    // Try alternate regex pattern
    const itemRegex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"gid"\s*:\s*"([0-9]+)"/g;
    while ((match = itemRegex.exec(html)) !== null) {
      tabs.push({ gid: match[2], name: match[1].trim() });
    }
  }

  console.log('Found tabs:', tabs);

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

  console.log('All tabs processed successfully!');
}

run().catch((err) => console.error('Error:', err));
