const fs = require('fs');
const path = require('path');

function parseCSVText(csvContent) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

const files = [
  '2025 2026 - 1A TERM 1.csv',
  '2025 2026 - 1A TERM 2.csv',
  '2025 2026 - 1A TERM 3.csv',
  '2025 2026 - 1B TERM 1.csv',
  '2025 2026 - 1B TERM 2.csv',
  '2025 2026 - 1B TERM 3.csv',
];

for (const fn of files) {
  const p = path.join(__dirname, '..', fn);
  if (!fs.existsSync(p)) {
    console.log(`Missing: ${fn}`);
    continue;
  }
  const rows = parseCSVText(fs.readFileSync(p, 'utf8'));
  console.log(`\n=== ${fn} (rows: ${rows.length}) ===`);
  console.log('Row 0 (first 8 cols):', rows[0] ? rows[0].slice(0, 8) : []);
  console.log('Row 1 (first 8 cols):', rows[1] ? rows[1].slice(0, 8) : []);
}
