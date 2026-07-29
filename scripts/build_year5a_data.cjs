const fs = require('fs');
const path = require('path');

function parseCSVText(text) {
  const lines = text.split(/\r?\n/);
  return lines.map(line => {
    const row = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  }).filter(r => r.some(c => c.length > 0));
}

const classId = '2025-2026-YEAR-5A';
const academicYearId = '2025-2026';

const termFiles = [
  { termCode: 'T1', filename: 'YEAR 5A TERM 1 - REPORT DATA.csv' },
  { termCode: 'T2', filename: 'YEAR 5A TERM 2  - REPORT DATA.csv' },
  { termCode: 'T3', filename: 'YEAR 5A TERM 3 - REPORT DATA.csv' },
];

const subjectsMap = [
  { code: 'ENG', totalHeader: 'ENG EOT 100', gradeHeader: 'ENG GRADE', commentHeader: 'ENG COMMENT' },
  { code: 'MATH', totalHeader: 'MATH EOT 100', gradeHeader: 'MATH GRADE', commentHeader: 'MATH COMMENT' },
  { code: 'FRE', totalHeader: 'FRE EOT 100', gradeHeader: 'FRE GRADE', commentHeader: 'FRE COMMENT' },
  { code: 'ICT', totalHeader: 'ICT EOT 100', gradeHeader: 'ICT GRADE', commentHeader: 'ICT COMMENT', altTotal: 'I.C.T EOT 100', altGrade: 'I.C.T GRADE', altComment: 'I.C.T COMMENT' },
  { code: 'SCI', totalHeader: 'SCI EOT 100', gradeHeader: 'SCI GRADE', commentHeader: 'SCI COMMENT' },
  { code: 'BK', totalHeader: 'BK EOT 100', gradeHeader: 'BK GRADE', commentHeader: 'BK COMMENT' },
  { code: 'HUM', totalHeader: 'HUM. EOT 100', gradeHeader: 'HUM. GRADE', commentHeader: 'HUM. COMMENT', altTotal: 'HUM EOT 100', altGrade: 'HUM GRADE', altComment: 'HUM COMMENT' },
  { code: 'MUSIC', totalHeader: 'MUSIC EOT 100', gradeHeader: 'MUSIC GRADE', commentHeader: 'MUSIC COMMENT' },
  { code: 'PROJ', totalHeader: 'PROJ EOT 100', gradeHeader: 'PROJ GRADE', commentHeader: 'PROJ COMMENT' },
];

const allScores = [];
const allSummaries = [];

for (const tFile of termFiles) {
  const filePath = path.join(__dirname, '..', tFile.filename);
  if (!fs.existsSync(filePath)) continue;
  const csvContent = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSVText(csvContent);
  let headerRowIndex = rows.findIndex(r => r.includes('STUDENT NAME') || r.includes('STUDENT ID'));
  if (headerRowIndex === -1) headerRowIndex = 0;
  const headers = rows[headerRowIndex].map(h => h.trim().toUpperCase());
  const getColIndex = (name, altName) => {
    let idx = headers.indexOf(name.toUpperCase());
    if (idx !== -1) return idx;
    if (altName) {
      idx = headers.indexOf(altName.toUpperCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const idxName = getColIndex('STUDENT NAME');
  const idxRawScore = getColIndex('RAW SCORE');
  const idxAveScore = getColIndex('AVERAGE SCORE');
  const idxAveGrade = getColIndex('AVE GRADE', 'AVE GRA');
  const idxBestMark = getColIndex('BEST MARK');
  const idxBestGrade = getColIndex('BEST GRADE');
  const idxLeastMark = getColIndex('LEAST MARK');
  const idxLeastGrade = getColIndex('LEAST GRADE');
  const idxRank = getColIndex('RANK');
  const idxGeneralComment = getColIndex("CLASS TEACHER'S COMMENT", "CLASS TEACHER’S COMMENT");
  const idxPeComment = getColIndex('PE COMMENT', 'PE T1');
  const idxClubComment = getColIndex('CLUB COMMENT', 'CLUB T1');

  const rawDataRows = rows.slice(headerRowIndex + 1);

  let stuIdx = 1;
  for (const row of rawDataRows) {
    const studentName = idxName !== -1 ? row[idxName] : '';
    if (!studentName || studentName.toUpperCase().includes('SAIS REPORT') || studentName.toUpperCase().includes('AVERAGE')) continue;
    
    const studentKey = `SAISDAN05A${String(stuIdx).padStart(3, '0')}`;
    const studentId = studentKey;
    stuIdx++;
    const termKey = `${academicYearId}-${tFile.termCode}`;

    const subjectLines = [];
    for (const sub of subjectsMap) {
      const cTotal = getColIndex(sub.totalHeader, sub.altTotal);
      if (cTotal === -1 || !row[cTotal]) continue;
      const totalScore = Number(row[cTotal]) || 0;
      const cGrade = getColIndex(sub.gradeHeader, sub.altGrade);
      const cComment = getColIndex(sub.commentHeader, sub.altComment);
      const grade = cGrade !== -1 && row[cGrade] ? row[cGrade] : 'U';
      const comment = cComment !== -1 && row[cComment] ? row[cComment] : '';
      
      subjectLines.push({ code: sub.code, name: sub.code, totalScore, grade });

      allScores.push({
        id: `${termKey}-YEAR-5A-${studentKey}-${sub.code}`,
        studentId,
        studentKey,
        classId,
        subjectCode: sub.code,
        mode: 'EOT',
        termKey,
        academicYear: '2025_2026',
        totalScore,
        grade,
        comment,
      });
    }

    const rawScore = idxRawScore !== -1 && row[idxRawScore] ? Number(row[idxRawScore]) : 0;
    const averageScore = idxAveScore !== -1 && row[idxAveScore] ? Number(row[idxAveScore]) : 0;
    const aveGrade = idxAveGrade !== -1 && row[idxAveGrade] ? row[idxAveGrade] : 'U';
    const bestMark = idxBestMark !== -1 && row[idxBestMark] ? Number(row[idxBestMark]) : 0;
    const bestGrade = idxBestGrade !== -1 && row[idxBestGrade] ? row[idxBestGrade] : 'A*';
    const leastMark = idxLeastMark !== -1 && row[idxLeastMark] ? Number(row[idxLeastMark]) : 0;
    const leastGrade = idxLeastGrade !== -1 && row[idxLeastGrade] ? row[idxLeastGrade] : 'U';
    const rank = idxRank !== -1 && row[idxRank] ? Number(row[idxRank]) : 1;
    const generalComment = idxGeneralComment !== -1 && row[idxGeneralComment] ? row[idxGeneralComment] : '';
    const peComment = idxPeComment !== -1 && row[idxPeComment] ? row[idxPeComment] : '';
    const clubComment = idxClubComment !== -1 && row[idxClubComment] ? row[idxClubComment] : '';

    allSummaries.push({
      id: `sum-${termKey}-${studentKey}`,
      studentId,
      classId,
      mode: 'EOT',
      termKey,
      academicYear: '2025_2026',
      rawScore,
      averageScore,
      aveGrade,
      bestMark,
      bestGrade,
      leastMark,
      leastGrade,
      rank,
      peComment,
      clubComment,
      generalComment,
      teacherName: 'MR. HECTOR ARYIKU',
      className: 'YEAR 5A',
      programme: 'PRIMARY',
      finalized: true,
      subjectLines,
    });
  }
}

const outTs = `import type { AssessmentScore, ReportSummary } from "../types";\n\n` +
  `export const HISTORICAL_YEAR5A_SCORES: AssessmentScore[] = ` + JSON.stringify(allScores, null, 2) + ` as any;\n\n` +
  `export const HISTORICAL_YEAR5A_SUMMARIES: ReportSummary[] = ` + JSON.stringify(allSummaries, null, 2) + ` as any;\n`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'year5aHistoricalData.ts'), outTs);
console.log(`Successfully generated src/data/year5aHistoricalData.ts with ${allScores.length} scores and ${allSummaries.length} summaries.`);
