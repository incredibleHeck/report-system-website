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

const year3AStudents = [
  'Addo Yaw Sarpong',
  'Adutwum Elyon',
  'Agbeker Kezia Rosina',
  'Agyekum Keshia',
  'Ajavon Elyan Jerome',
  'Akrong Sidatey',
  'Amaniampong Ann Marie',
  'Amanquandoh Chanan-Matt',
  'Aryee Ely',
  'Azameti Anela',
  'Badza Stephen',
  'Bimpong Michelle',
  'Boateng Prince-Dag',
  'Cofie Anounyam',
  'Darko Naa Ofeibea',
  'Essienyi Onokwafo',
  'Kumi Kirkman',
  'Kwasie Jayden Jayden Selali',
  'Kyere Kennedy',
  'Lamptey Jaelyn',
  'Lamptey Manuel',
  'Paintsil Fiifi',
  'Quartey Jessie Shiloh',
  'Tetteh Tehillah-Praise',
  'Wesley-Ansah Mirielle-Dominique',
  'Zowonu Mawuena',
];

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

console.log('Testing 3A rows matching:');
const t3a2 = parseCSVText(fs.readFileSync(path.join(__dirname, '..', '2025 2026 - 3A TERM 2.csv'), 'utf8'));
const dataRows3A = t3a2.slice(1);
console.log(`3A T2 data rows: ${dataRows3A.length} (Expected: ${year3AStudents.length})`);

for (let i = 0; i < dataRows3A.length; i++) {
  console.log(`Row ${i + 1}: ${year3AStudents[i]} -> Eng Comment preview: "${dataRows3A[i][4]?.slice(0, 40)}..."`);
}
