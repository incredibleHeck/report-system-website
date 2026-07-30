const fs = require('fs');
const path = require('path');

const eotPath = 'c:\\Users\\me\\reportsystem\\report-system-website\\src\\components\\reports\\EotReportCard.tsx';
const midPath = 'c:\\Users\\me\\reportsystem\\report-system-website\\src\\components\\reports\\MidtermReportCard.tsx';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace verticalAlign: 'top' with 'middle' in style objects
  content = content.replace(/verticalAlign:\s*'top'/g, "verticalAlign: 'middle'");
  
  // Ensure border thicknesses are integers (e.g. 3px instead of 2.5px) for html2canvas
  content = content.replace(/2\.5px solid/g, "3px solid");
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', filePath);
}

fixFile(eotPath);
fixFile(midPath);
