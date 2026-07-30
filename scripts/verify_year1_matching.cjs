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

const year1AStudents = [
  'Acquah Ephraim Nyiraba A.',
  'Adika Sesinam',
  'Adu Elsa',
  'Adutwum Rapha',
  'Agama Pamela',
  'Agbenu Gianna',
  'Ahadzie Ajavor Jra Joshua R.',
  'Akoh-Mensah Kwamena Nyame',
  'Amoako Jazariah Boakye',
  'Amofa Kofi Osei Tutu',
  'Amoh-Barimah Ewuresi Bo Nyameye',
  'Amoquandoh-Ocran Chessed-Mira',
  'Andoh Peter',
  'Asante Nti Akyeamaa Adepa',
  'Aseidu Ariel Nana Yaa',
  'Boateng Becca-Maria Ayeyi',
  'Clottey Abigail Yehowah Keeno',
  'Denkyi Ezra Kwaku',
  'Dumfeh Beulah Nana Abena',
  'Essuman Cyrus Kobina Nyamekye',
  'Hammond Audeyln Anju N.K',
  'Johnson Curtis Kofi Dautey',
  'Krofuah Rebecca Jayna',
  'Mbroh Keren Cicy Naana G.',
  'Nhyiraba Erica',
  'Nnamani Chimamanda Tehila',
  'Quansah Lael Baaba N.',
];

const year1BStudents = [
  'Abaidoo Cephas',
  'Aboagye-Kodjoe Carly',
  'Fawaz V. Abukari',
  'Addo-Quaye Ellison',
  'Adjei-Gyabaah Afia Nyameadom',
  'Adzoro Makafui Aimee-Johnna',
  'Afetor Louisa',
  'Agbenu Eliana Selikem',
  'Aidoo K. Ewurabena Adelaide',
  'Akanni Olatudun Alice Kayleigh',
  'Akoh-Mensah Nyame Kwame',
  'Asare-Larwah Reginald Albert',
  'Asare Nana Ama Senanu Michelle',
  'Attipoe Elikem Levi',
  'Bosomtwe Appiah Ayeyi Kojo',
  'Dekpor Nana Aba Blessing',
  'Frimpong Asare Bediako Keona',
  'Korsah Israel Yaw Barima',
  'Mbaeri Johnson Jensen',
  'Oglitei-Tetteh A. K. Zoe-Gracie',
  'Owusu-Yebuah Divine',
  'Pappoe Isaac Love Jnr',
  'Pinkrah Kayla-Veronica',
  'Quarcoo-Zah Kayden',
  'Sittor Seyram Brittany',
  'Tsatsu Tackie Jordyn Jada',
];

const files1A = ['2025 2026 - 1A TERM 1.csv', '2025 2026 - 1A TERM 2.csv', '2025 2026 - 1A TERM 3.csv'];
for (const fn of files1A) {
  console.log(`\nTesting ${fn}:`);
  const rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', fn), 'utf8'));
  const dataRows = rows.slice(1);
  let unmapped = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const csvName = dataRows[i][0];
    const match = year1AStudents.find((s) => nameMatch(s, csvName));
    if (!match) {
      console.log(`  ❌ Unmapped row ${i + 1}: "${csvName}"`);
      unmapped++;
    }
  }
  if (unmapped === 0) console.log(`  ✔ All ${dataRows.length} rows matched perfectly for 1A!`);
}

const files1B = ['2025 2026 - 1B TERM 1.csv', '2025 2026 - 1B TERM 2.csv', '2025 2026 - 1B TERM 3.csv'];
for (const fn of files1B) {
  console.log(`\nTesting ${fn}:`);
  const rows = parseCSVText(fs.readFileSync(path.join(__dirname, '..', fn), 'utf8'));
  const dataRows = rows.slice(1);
  let unmapped = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const csvName = dataRows[i][0];
    const match = year1BStudents.find((s) => nameMatch(s, csvName));
    if (!match) {
      console.log(`  ❌ Unmapped row ${i + 1}: "${csvName}"`);
      unmapped++;
    }
  }
  if (unmapped === 0) console.log(`  ✔ All ${dataRows.length} rows matched perfectly for 1B!`);
}
