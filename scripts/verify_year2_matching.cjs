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

const year2AStudents = [
  'Abbey-Brown Maame Araba',
  'Agbenyo Oswell Nana Kwame',
  'Akrong Sikatsukor Nyameakwan',
  'Andoh Addy Nii Tetteh',
  'Baako Elyon Kwaku',
  'Banini Bubune',
  'Bannerman Elliana',
  'Dadson Ehurusi Nyamehan',
  'Danquah Ohemaa Boachie',
  'Darfour Isaac Adade',
  'Dotou Adira Ewoenam',
  'Edwin Fiifi',
  'Etison Stephen Nana Kwame',
  'Johnson Caritas Ama Daaley',
  'Kissi Papa Kwafo Adjei Victor',
  'Kuditchar Kayden Ernest',
  'Azumah Nelson Jasper',
  'Nuhu Salifu',
  'Ofori Charis Adelaide Ewuradwoa',
  'Parker Longdon Jael Abigail Aseye',
  'Quaye Deandre',
  'Sampson Jayden Ekow',
  'Sarpong Heavenly Nyamedea',
  'Vardon-Odonkor Jayla',
  'Willis Naila Baaba',
  'Tetteh Awunyo Prince Elorm',
];

const year2BStudents = [
  'Abrahams Sean Sydney',
  'Addo Tamanda Maame Akua',
  'Adjei-Gyabaah Nyamenhyira',
  'Adu-Obeng Vincy',
  'Agbenu Keon Kekeli',
  'Aidoo Shaun',
  'Aloryi-Antwi Prince Obrempong',
  'Amissah Ellona Nana Adjoa',
  'Amo Avery Julian',
  'Amponsah Emmanuel Nhyiraba',
  'Amwami Elliana Mawuse',
  'Ankrah Ethan Davis',
  'Appiah Nana Kwadwo',
  'Asiamah Makayla Maame',
  'Boateng Nimdie-Sika',
  'Cudjoe Benel Elikem',
  'Dadzie Papa Kofi',
  'Dadzie Putiel',
  'Kuunim-Marbell Avidan',
  'Lamptey Naa Lamiley',
  'Larbi Neriah',
  'Lord-Mensah Kayla Anounyam',
  'Odonkor Karissa Darice',
  'Seneagya Orli Thea',
  'Tornye Enyonam',
];

const files2A = ['2025 2026 - 2A TERM 1.csv', '2025 2026 - 2A TERM 2.csv', '2025 2026 - 2A TERM 3.csv'];
for (const fn of files2A) {
  console.log(`\nTesting ${fn}:`);
  const rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', fn), 'utf8'));
  let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID') || r.includes('ENG CW 20') || r.includes('ENG MT 20'));
  if (headerRowIndex === -1) headerRowIndex = 0;
  const dataRows = rows.slice(headerRowIndex + 1);
  console.log(`  Data rows count: ${dataRows.length} (Expected: 26)`);
  let unmapped = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const csvName = dataRows[i][0];
    const match = year2AStudents.find((s) => nameMatch(s, csvName));
    if (!match) {
      const idxStr = String(i + 1).padStart(3, '0');
      const fallbackMatch = year2AStudents[i];
      console.log(`  ⚠️ Name match failed for row ${i + 1}: "${csvName}". Fallback by index: "${fallbackMatch}"`);
    }
  }
}

const files2B = ['2025 2026 - 2B TERM 1.csv', '2025 2026 - 2B TERM 2.csv', '2025 2026 - 2B TERM 3.csv'];
for (const fn of files2B) {
  console.log(`\nTesting ${fn}:`);
  const rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', fn), 'utf8'));
  let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID') || r.includes('ENG CW 20') || r.includes('ENG MT 20'));
  if (headerRowIndex === -1) headerRowIndex = 0;
  const dataRows = rows.slice(headerRowIndex + 1);
  console.log(`  Data rows count: ${dataRows.length} (Expected: 25)`);
  let unmapped = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const csvName = dataRows[i][0];
    const match = year2BStudents.find((s) => nameMatch(s, csvName));
    if (!match) {
      const idxStr = String(i + 1).padStart(3, '0');
      const fallbackMatch = year2BStudents[i];
      console.log(`  ⚠️ Name match failed for row ${i + 1}: "${csvName}". Fallback by index: "${fallbackMatch}"`);
    }
  }
}
