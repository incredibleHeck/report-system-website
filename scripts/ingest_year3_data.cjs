const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
try {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount),
  });
} catch (error) {
  console.error(`\n[ERROR] Could not find or load service-account.json at ${serviceAccountPath}`);
  process.exit(1);
}

const db = getFirestore();

class BatchChunker {
  constructor(firestoreDb, maxOps = 100) {
    this.db = firestoreDb;
    this.maxOps = maxOps;
    this.batch = firestoreDb.batch();
    this.count = 0;
    this.totalCommits = 0;
  }

  async set(ref, data, options) {
    if (options) {
      this.batch.set(ref, data, options);
    } else {
      this.batch.set(ref, data);
    }
    this.count++;
    if (this.count >= this.maxOps) {
      await this.commit();
    }
  }

  async commit() {
    if (this.count > 0) {
      const batchToCommit = this.batch;
      const opsCount = this.count;
      this.batch = this.db.batch();
      this.count = 0;
      
      let attempts = 0;
      while (attempts < 5) {
        try {
          await batchToCommit.commit();
          this.totalCommits++;
          console.log(`✔ [BatchChunker] Committed batch #${this.totalCommits} (${opsCount} ops).`);
          await new Promise((res) => setTimeout(res, 150));
          break;
        } catch (err) {
          attempts++;
          console.warn(`  ⚠️ Batch commit failed (attempt ${attempts}/5): ${err.message}. Retrying...`);
          if (attempts >= 5) throw err;
          await new Promise((res) => setTimeout(res, 1000 * attempts));
        }
      }
    }
  }
}

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

const subjectsMap = [
  { code: 'ENG', name: 'English Language', totalHeader: 'ENG EOT 100', gradeHeader: 'ENG GRADE', commentHeader: 'ENG COMMENT', cwHeader: 'ENG CW 20', mtHeader: 'ENG MT 20', eot60Header: 'ENG EOT 60' },
  { code: 'MATH', name: 'Mathematics', totalHeader: 'MATH EOT 100', gradeHeader: 'MATH GRADE', commentHeader: 'MATH COMMENT', cwHeader: 'MATH CW 20', mtHeader: 'MATH MT 20', eot60Header: 'MATH EOT 60' },
  { code: 'FRE', name: 'French Language', totalHeader: 'FRE EOT 100', gradeHeader: 'FRE GRADE', commentHeader: 'FRE COMMENT', cwHeader: 'FRE CW 20', mtHeader: 'FRE MT 20', eot60Header: 'FRE EOT 60' },
  { code: 'ICT', name: 'Computing / ICT', totalHeader: 'ICT EOT 100', gradeHeader: 'ICT GRADE', commentHeader: 'ICT COMMENT', altTotal: 'I.C.T EOT 100', altGrade: 'I.C.T GRADE', altComment: 'I.C.T COMMENT', cwHeader: 'ICT CW 20', altCw: 'I.C.T CW 20', mtHeader: 'ICT MT 20', altMt: 'I.C.T MT 20', eot60Header: 'ICT EOT 60', altEot60: 'I.C.T EOT 60' },
  { code: 'SCI', name: 'Science', totalHeader: 'SCI EOT 100', gradeHeader: 'SCI GRADE', commentHeader: 'SCI COMMENT', cwHeader: 'SCI CW 20', mtHeader: 'SCI MT 20', eot60Header: 'SCI EOT 60' },
  { code: 'BK', name: 'Religious & Moral Education', totalHeader: 'BK EOT 100', gradeHeader: 'BK GRADE', commentHeader: 'BK COMMENT', cwHeader: 'BK CW 20', mtHeader: 'BK MT 20', eot60Header: 'BK EOT 60' },
  { code: 'HUM', name: 'Humanities / Social Studies', totalHeader: 'HUM. EOT 100', gradeHeader: 'HUM. GRADE', commentHeader: 'HUM. COMMENT', altTotal: 'HUM EOT 100', altGrade: 'HUM GRADE', altComment: 'HUM COMMENT', cwHeader: 'HUM. CW 20', altCw: 'HUM CW 20', mtHeader: 'HUM. MT 20', altMt: 'HUM MT 20', eot60Header: 'HUM. EOT 60', altEot60: 'HUM EOT 60' },
  { code: 'MUSIC', name: 'Music', totalHeader: 'MUSIC EOT 100', gradeHeader: 'MUSIC GRADE', commentHeader: 'MUSIC COMMENT' },
  { code: 'PROJ', name: 'Project Work', totalHeader: 'PROJ EOT 100', gradeHeader: 'PROJ GRADE', commentHeader: 'PROJ COMMENT' },
];

const targetFiles = [
  // 3A
  { filename: '2025 2026 - 3A TERM 1.csv', classCode: 'YEAR-3A', className: 'YEAR 3A', termCode: 'T1', termId: '2025-2026-T1', termName: 'Term 1' },
  { filename: '2025 2026 - 3A TERM 2.csv', classCode: 'YEAR-3A', className: 'YEAR 3A', termCode: 'T2', termId: '2025-2026-T2', termName: 'Term 2' },
  { filename: '2025 2026 - 3A TERM 3.csv', classCode: 'YEAR-3A', className: 'YEAR 3A', termCode: 'T3', termId: '2025-2026-T3', termName: 'Term 3' },
  // 3B
  { filename: '2025 2026 - 3B TERM 1.csv', classCode: 'YEAR-3B', className: 'YEAR 3B', termCode: 'T1', termId: '2025-2026-T1', termName: 'Term 1' },
  { filename: '2025 2026 - 3B TERM 2.csv', classCode: 'YEAR-3B', className: 'YEAR 3B', termCode: 'T2', termId: '2025-2026-T2', termName: 'Term 2' },
  { filename: '2025 2026 - 3B TERM 3.csv', classCode: 'YEAR-3B', className: 'YEAR 3B', termCode: 'T3', termId: '2025-2026-T3', termName: 'Term 3' },
];

async function run() {
  console.log('🚀 Starting Year 3A and 3B Historical Data Ingestion...');
  const chunker = new BatchChunker(db, 200);
  const academicYearId = '2025-2026';
  const academicYear = '2025/2026';

  // 1. Load enrolled students from Firestore
  const stuSnap = await db.collection('students').get();
  const allStudents = stuSnap.docs.map((d) => d.data());

  const enrSnap = await db.collection('sais_classEnrollments').get();
  const allEnrollments = enrSnap.docs.map((d) => d.data());

  const year3Students = [];
  for (const enr of allEnrollments) {
    if (enr.classId === '2025-2026-YEAR-3A' || enr.classId === '2025-2026-YEAR-3B') {
      const st = allStudents.find((s) => s.studentKey === enr.studentKey);
      if (st) {
        year3Students.push({
          studentKey: enr.studentKey,
          name: st.name,
          classId: enr.classId,
          className: enr.className,
          index: enr.index,
        });
      }
    }
  }
  
  // Sort by index so index 001, 002... match row positions
  year3Students.sort((a, b) => (a.classId + a.index).localeCompare(b.classId + b.index));
  console.log(`📋 Found ${year3Students.length} registered Year 3 students in Firestore.`);

  const generatedScores = [];
  const generatedSummaries = [];

  for (const tFile of targetFiles) {
    const filePath = path.join(__dirname, '..', tFile.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ Missing file: ${tFile.filename}`);
      continue;
    }

    const classId = `2025-2026-${tFile.classCode}`;
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSVText(csvContent);

    let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID') || r.includes('ENG CW 20') || r.includes('ENG MT 20'));
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headers = rows[headerRowIndex].map((h) => h.trim().toUpperCase());

    const getColIndex = (name, altName) => {
      if (!name) return -1;
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
    const idxTeacherName = getColIndex("CLASS TEACHER'S NAME", "CLASS TEACHER’S NAME");

    const dataRows = rows.slice(headerRowIndex + 1);
    console.log(`  📄 Processing ${tFile.filename} (${dataRows.length} rows for ${tFile.className} ${tFile.termName})...`);

    const classStudents = year3Students.filter((s) => s.classId === classId);

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      const studentName = idxName !== -1 ? row[idxName] : '';

      if (
        studentName && (
        studentName.toUpperCase().includes('SAIS REPORT') ||
        studentName.toUpperCase().includes('AVERAGE'))
      ) continue;

      let matchedStudent = null;
      if (studentName) {
        matchedStudent = classStudents.find((s) => nameMatch(s.name, studentName));
      }
      
      // If studentName col is not present (or empty in shifted header), match by exact row index!
      if (!matchedStudent) {
        const idxStr = String(rIdx + 1).padStart(3, '0');
        matchedStudent = classStudents.find((s) => s.index === idxStr);
      }

      if (!matchedStudent) {
        console.warn(`  ⚠️ Could not match student at row ${rIdx + 1}: "${studentName}" in ${tFile.className}`);
        continue;
      }

      const studentKey = matchedStudent.studentKey;
      const termKey = `${academicYearId}-${tFile.termCode}`;
      const termId = tFile.termId;
      const subjectLines = [];

      for (const sub of subjectsMap) {
        const cTotal = getColIndex(sub.totalHeader, sub.altTotal);
        if (cTotal === -1 || !row[cTotal]) continue;

        const totalScore = Number(row[cTotal]) || 0;
        const cGrade = getColIndex(sub.gradeHeader, sub.altGrade);
        const cComment = getColIndex(sub.commentHeader, sub.altComment);
        const cCw = sub.cwHeader ? getColIndex(sub.cwHeader, sub.altCw) : -1;
        const cMt = sub.mtHeader ? getColIndex(sub.mtHeader, sub.altMt) : -1;
        const cEot60 = sub.eot60Header ? getColIndex(sub.eot60Header, sub.altEot60) : -1;

        const grade = cGrade !== -1 && row[cGrade] ? row[cGrade] : 'U';
        const comment = cComment !== -1 && row[cComment] ? row[cComment] : '';
        const cwScore = cCw !== -1 && row[cCw] ? Number(row[cCw]) || 0 : 0;
        const mtScore = cMt !== -1 && row[cMt] ? Number(row[cMt]) || 0 : 0;
        const eotScore = cEot60 !== -1 && row[cEot60] ? Number(row[cEot60]) || 0 : 0;

        subjectLines.push({ code: sub.code, name: sub.code, totalScore, grade });

        const scoreDocId = `${termId}-${tFile.classCode}-${studentKey}-${sub.code}`;
        const scoreData = {
          id: scoreDocId,
          studentId: studentKey,
          studentKey,
          legacyStudentId: studentKey,
          displayId: studentKey,
          classId,
          classStreamId: classId,
          subjectCode: sub.code,
          mode: 'EOT',
          termKey,
          termId,
          academicYear: '2025_2026',
          academicYearId,
          cwScore,
          mtScore,
          eotScore,
          totalScore,
          grade,
          comment,
        };

        generatedScores.push(scoreData);

        const scoreRef = db.collection('sais_scores').doc(scoreDocId);
        const stuMarkRef = db.collection('studentMarks').doc(scoreDocId);

        await chunker.set(scoreRef, scoreData, { merge: true });
        await chunker.set(stuMarkRef, scoreData, { merge: true });
      }

      const rawScore = idxRawScore !== -1 && row[idxRawScore] ? Number(row[idxRawScore]) || 0 : 0;
      const averageScore = idxAveScore !== -1 && row[idxAveScore] ? Number(row[idxAveScore]) || 0 : 0;
      const aveGrade = idxAveGrade !== -1 && row[idxAveGrade] ? row[idxAveGrade] : 'U';
      const bestMark = idxBestMark !== -1 && row[idxBestMark] ? Number(row[idxBestMark]) || 0 : 0;
      const bestGrade = idxBestGrade !== -1 && row[idxBestGrade] ? row[idxBestGrade] : 'A*';
      const leastMark = idxLeastMark !== -1 && row[idxLeastMark] ? Number(row[idxLeastMark]) || 0 : 0;
      const leastGrade = idxLeastGrade !== -1 && row[idxLeastGrade] ? row[idxLeastGrade] : 'U';
      const rank = idxRank !== -1 && row[idxRank] ? Number(row[idxRank]) || null : null;
      const generalComment = idxGeneralComment !== -1 && row[idxGeneralComment] ? row[idxGeneralComment] : '';
      const peComment = idxPeComment !== -1 && row[idxPeComment] ? row[idxPeComment] : '';
      const clubComment = idxClubComment !== -1 && row[idxClubComment] ? row[idxClubComment] : '';
      const teacherName = idxTeacherName !== -1 && row[idxTeacherName] ? row[idxTeacherName] : 'MRS. PAULINE ASANTE NTI';

      const sumDocId = `${termId}-${tFile.classCode}-${studentKey}`;
      const sumData = {
        id: sumDocId,
        studentId: studentKey,
        studentKey,
        legacyStudentId: studentKey,
        displayId: studentKey,
        classId,
        classStreamId: classId,
        mode: 'EOT',
        termKey,
        termId,
        academicYear: '2025_2026',
        academicYearId,
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
        teacherName,
        className: tFile.className,
        programme: 'PRIMARY',
        finalized: true,
        subjectLines,
      };

      generatedSummaries.push(sumData);

      const sumRef = db.collection('sais_reportSummaries').doc(sumDocId);
      await chunker.set(sumRef, sumData, { merge: true });
    }
  }

  await chunker.commit();
  console.log(`✔ Ingested ${generatedScores.length} assessment scores and ${generatedSummaries.length} report summaries into Firestore for Year 3A & 3B.`);

  // Write static fallback TypeScript file src/data/year3HistoricalData.ts
  const outTs = `import type { AssessmentScore, ReportSummary } from "../types";\n\n` +
    `export const HISTORICAL_YEAR3_SCORES: AssessmentScore[] = ` + JSON.stringify(generatedScores, null, 2) + ` as any;\n\n` +
    `export const HISTORICAL_YEAR3_SUMMARIES: ReportSummary[] = ` + JSON.stringify(generatedSummaries, null, 2) + ` as any;\n`;

  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'year3HistoricalData.ts'), outTs);
  console.log(`✔ Written src/data/year3HistoricalData.ts successfully.`);
}

run().catch((err) => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
