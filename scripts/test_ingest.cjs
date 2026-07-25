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
  { termCode: 'T1', termId: '2025-2026-T1', filename: 'YEAR 5A TERM 1 - REPORT DATA.csv', maxRows: 24 },
  { termCode: 'T2', termId: '2025-2026-T2', filename: 'YEAR 5A TERM 2  - REPORT DATA.csv', maxRows: 25 },
  { termCode: 'T3', termId: '2025-2026-T3', filename: 'YEAR 5A TERM 3 - REPORT DATA.csv', maxRows: 25 },
];

for (const tf of files) {
  const filePath = path.join(__dirname, '..', tf.filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSVText(content);
  let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID'));
  if (headerRowIndex === -1) headerRowIndex = 0;
  const headers = rows[headerRowIndex].map((h) => h.trim().toUpperCase());
  const idxName = headers.indexOf('STUDENT NAME');
  const rawDataRows = rows.slice(headerRowIndex + 1);
  const dataRows = rawDataRows.slice(0, tf.maxRows);
  console.log(`${tf.termCode} (${tf.filename}): header index ${headerRowIndex}, header length ${headers.length}, student name idx ${idxName}, data rows ${dataRows.length}`);
  if (dataRows.length > 0) {
    console.log(`   First student: '${dataRows[0][idxName]}', Last student: '${dataRows[dataRows.length-1][idxName]}'`);
  }
}
