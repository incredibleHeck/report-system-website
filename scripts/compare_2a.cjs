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

const t1Rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', '2025 2026 - 2A TERM 1.csv'), 'utf8')).slice(1);
const t2Rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', '2025 2026 - 2A TERM 2.csv'), 'utf8')).slice(1);

console.log('--- 2A Term 1 Student Names ---');
t1Rows.forEach((r, idx) => console.log(`${idx + 1}. ${r[0]}`));

console.log('\n--- 2A Term 2 Student Names ---');
t2Rows.forEach((r, idx) => console.log(`${idx + 1}. ${r[0]}`));
