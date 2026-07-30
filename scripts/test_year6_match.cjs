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
  '2025 2026 - 6A TERM 1.csv',
  '2025 2026 - 6A TERM 2.csv',
  '2025 2026 - 6A TERM 3.csv',
  '2025 2026 - 6B TERM 1.csv',
  '2025 2026 - 6B TERM 2.csv',
  '2025 2026 - 6B TERM 3.csv',
];

for (const filename of files) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filename}`);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSVText(content);
  console.log(`✔ ${filename}: ${rows.length} total rows parsed (Header student name col: ${rows[0][1] || rows[0][0]})`);
}
