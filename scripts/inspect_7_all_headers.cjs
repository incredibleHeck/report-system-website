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

const files = ['2025 2026 - 7 TERM 1.csv', '2025 2026 - 7 TERM 2.csv', '2025 2026 - 7 TERM 3.csv'];
for (const fn of files) {
  const rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', fn), 'utf8'));
  let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID') || r.includes('ENG CW 20') || r.includes('ENG MT 20'));
  if (headerRowIndex === -1) headerRowIndex = 0;
  console.log(`\n=== ${fn} Headers ===`);
  console.log(rows[headerRowIndex]);
}
