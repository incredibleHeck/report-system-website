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

function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatch(nameA, nameB) {
  const tokensA = new Set(normalizeName(nameA).split(' ').filter((t) => t.length > 1));
  const tokensB = new Set(normalizeName(nameB).split(' ').filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  
  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) matches++;
  }
  return matches >= 2 || (tokensA.size === 1 && matches === 1);
}

const year7Students = [
  'Ablorh Naa Adjeley',
  'Amankwah Yaw Sompa',
  'Antwi Nana Yaw',
  'Appiah Christin',
  'Aryee Maisie',
  'Bosomtwe Joojo Adom',
  'Cofie Nkunim',
  'Effah Haniel',
  'Gaisie Nana Afran',
  'Gyasi Oheneba Aseda',
  'Klutse Jude',
  'Kwapong Ethan Fiifi',
  'Lamptey Haniel',
  'Mbroh Lisa',
  'Nimako Eno Afia',
  'Nti Caleb Nyametease Asante',
  'Obeng Chriselda',
  'Odoi Catherine Asiedu Kayla',
  'Odonkor Adiel',
  'Owusu Adwoa Bukurah',
  'Sackey Jude',
  'Seneagya Violet',
  'Stevenson Lisa',
  'Tagoe Kayden',
  'Tornye Klenam',
  'Welds Charissa Jayne',
  'Zowonu Mawuli',
];

const files7 = ['2025 2026 - 7 TERM 1.csv', '2025 2026 - 7 TERM 2.csv', '2025 2026 - 7 TERM 3.csv'];
for (const fn of files7) {
  console.log(`\nTesting ${fn}:`);
  const rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', fn), 'utf8'));
  let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID') || r.includes('ENG CW 20') || r.includes('ENG MT 20'));
  if (headerRowIndex === -1) headerRowIndex = 0;
  console.log('Row 0 headers (first 10):', rows[headerRowIndex].slice(0, 10));
  const dataRows = rows.slice(headerRowIndex + 1);
  console.log(`  Data rows count: ${dataRows.length} (Expected: 27)`);
  let unmapped = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const csvName = dataRows[i][0];
    const match = year7Students.find((s) => nameMatch(s, csvName));
    if (!match) {
      const idxStr = String(i + 1).padStart(3, '0');
      const fallbackMatch = year7Students[i];
      console.log(`  ⚠️ Name match failed for row ${i + 1}: "${csvName}". Fallback by index: "${fallbackMatch}"`);
    }
  }
}
