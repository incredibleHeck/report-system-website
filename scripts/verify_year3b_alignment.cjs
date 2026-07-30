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

const year3BStudents = [
  'Abossey Allen',
  'Andoh Kesson Jaden Nanabanyin',
  'Antwi Fillmore Anuonyam Ofori',
  'Asante Nti Awurabena Aseda',
  'Bekee Shekinahglory',
  'Bisiw Mikayla Annobil',
  'Boateng Agyemang Prince',
  'Bondzie-Simpson Hephzibah',
  'Buabeng Nana Kojo Amponsah',
  'Bunaf Danjuma Adnan',
  'Daleku Jason Eli',
  'Denkyi Elsa Nhyira',
  'Denteh Kemuel',
  'Gyansah Eddy Jayden',
  'Gyasi Adansie Kwabena Nyantakyi',
  'Lawson Edwin David Ago',
  'Neequaye James Christian Nii Kotey',
  'Nhyiraba Danielle Akua Antwiwaa',
  'Obeng Joel Anuonyam',
  'Odonkor Jachin Jedidiah Tsui',
  'Osabutey Naana Ohui Kenie',
  'Owusu Ansah Zoey Danielle',
  'Pinkrah Calvin',
  'Sarpong Owusu Ama',
  'Sesenu Sloane Selikem Ama',
  'Tenkorang Miracle Edem',
];

console.log('Testing 3B T2 rows matching:');
const t3b2 = parseCSVText(fs.readFileSync(path.join(__dirname, '..', '2025 2026 - 3B TERM 2.csv'), 'utf8'));
const dataRows3B = t3b2.slice(1);
console.log(`3B T2 data rows: ${dataRows3B.length} (Expected: ${year3BStudents.length})`);

for (let i = 0; i < dataRows3B.length; i++) {
  console.log(`Row ${i + 1}: ${year3BStudents[i]} -> Eng Comment preview: "${dataRows3B[i][4]?.slice(0, 40)}..."`);
}
