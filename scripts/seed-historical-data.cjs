const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
try {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount),
  });
} catch (error) {
  console.error(`\n[ERROR] Could not find or load service-account.json at ${serviceAccountPath}`);
  console.error('Ensure service-account.json is present in the root directory.\n');
  process.exit(1);
}

const db = getFirestore();

/**
 * Batch Limit Guard: Enforces a maximum of 400 operations per batch.commit()
 * to prevent exceeding Firestore's 500-operation transaction limit.
 */
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

  async delete(ref) {
    this.batch.delete(ref);
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
      await batchToCommit.commit();
      this.totalCommits++;
      console.log(`✔ [BatchChunker] Committed batch #${this.totalCommits} (${opsCount} ops).`);
    }
  }
}

/**
 * STEP 1: Selective Reset (Purge Student & Mark Collections ONLY)
 * Wipes ONLY student profiles, class enrollments, scores, and report summaries.
 * Preserves structural collections: academicYears, classStreams / sais_classes.
 */
async function wipeExistingMatrix() {
  console.log('🧹 [STEP 1] Selective Purge: Wiping ONLY student & mark collections...');
  const chunker = new BatchChunker(db, 400);

  const collectionsToWipe = [
    'sais_classEnrollments',
    'sais_lifelongStudents',
    'sais_scores',
    'sais_reportSummaries',
    'sais_students',
    'students',
    'studentMarks',
  ];

  for (const colName of collectionsToWipe) {
    const snap = await db.collection(colName).get();
    console.log(`  Deleting ${snap.size} docs from '${colName}'...`);
    for (const docSnap of snap.docs) {
      await chunker.delete(docSnap.ref);
    }
  }

  await chunker.commit();
  console.log('✔ [STEP 1] Selective purge complete.');
}

/**
 * Helper to determine programme based on class name.
 */
function getProgrammeForClass(className) {
  if (className.toUpperCase().includes('YEAR 7')) return 'LOWER_SECONDARY';
  return 'PRIMARY';
}

/**
 * Robust multiline-aware CSV Parser
 */
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

/**
 * STEP 2: PROVISION 13 CLASS STREAMS & SEED 308 ACTIVE STUDENTS
 */
async function seedActiveStudentRegistry(chunker) {
  console.log('🌱 [STEP 2] Provisioning Class Streams (2026/2027 & 2025/2026) & Seeding 308 Active Students...');

  const classStreamsList = [
    { code: 'YEAR_1A', name: 'YEAR 1A', slug: 'YEAR-1A' },
    { code: 'YEAR_1B', name: 'YEAR 1B', slug: 'YEAR-1B' },
    { code: 'YEAR_2A', name: 'YEAR 2A', slug: 'YEAR-2A' },
    { code: 'YEAR_2B', name: 'YEAR 2B', slug: 'YEAR-2B' },
    { code: 'YEAR_3A', name: 'YEAR 3A', slug: 'YEAR-3A' },
    { code: 'YEAR_3B', name: 'YEAR 3B', slug: 'YEAR-3B' },
    { code: 'YEAR_4A', name: 'YEAR 4A', slug: 'YEAR-4A' },
    { code: 'YEAR_4B', name: 'YEAR 4B', slug: 'YEAR-4B' },
    { code: 'YEAR_5A', name: 'YEAR 5A', slug: 'YEAR-5A' },
    { code: 'YEAR_5B', name: 'YEAR 5B', slug: 'YEAR-5B' },
    { code: 'YEAR_6A', name: 'YEAR 6A', slug: 'YEAR-6A' },
    { code: 'YEAR_6B', name: 'YEAR 6B', slug: 'YEAR-6B' },
    { code: 'YEAR_7',  name: 'YEAR 7',  slug: 'YEAR-7'  },
  ];

  // Set System Active Pointer doc (2026/2027 Term 1)
  const systemSettingsRef = db.collection('systemSettings').doc('active');
  await chunker.set(systemSettingsRef, {
    activeAcademicYearId: '2026-2027',
    activeAcademicYear: '2026/2027',
    activeTermId: '2026-2027-T1',
    activeTermCode: 'T1',
    activeTermNumber: 1,
    activeTermName: 'Term 1',
    currentTermYearInfo: '2026/2027 — Term 1',
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Baseline Academic Years with Archived Status for prior years
  const baselineYears = [
    { id: '2026-2027', year: '2026/2027', status: 'active', isArchived: false },
    { id: '2025-2026', year: '2025/2026', status: 'archived', isArchived: true },
    { id: '2024-2025', year: '2024/2025', status: 'archived', isArchived: true },
    { id: '2023-2024', year: '2023/2024', status: 'archived', isArchived: true },
    { id: '2022-2023', year: '2022/2023', status: 'archived', isArchived: true },
    { id: '2021-2022', year: '2021/2022', status: 'archived', isArchived: true },
  ];

  for (const bYear of baselineYears) {
    const yearRef = db.collection('academicYears').doc(bYear.id);
    await chunker.set(yearRef, {
      id: bYear.id,
      academicYear: bYear.year,
      name: bYear.year,
      status: bYear.status,
      isArchived: bYear.isArchived,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }

  // Provision 13 Class Streams for 2026/2027 and 2025/2026
  for (const yearObj of [{ id: '2026-2027', year: '2026/2027', term: 'Term 1' }, { id: '2025-2026', year: '2025/2026', term: 'Term 1' }]) {
    for (const cs of classStreamsList) {
      const classId = `${yearObj.id}-${cs.slug}`;
      const programme = getProgrammeForClass(cs.name);
      const classData = {
        id: classId,
        name: cs.name,
        academicYearId: yearObj.id,
        academicYear: yearObj.year,
        programme,
        schoolId: 'sais-school-main',
        teacherId: 'demo-teacher-primary',
        subjectTeachers: [
          { subjectCode: 'ENG', teacherId: 'demo-teacher-primary' },
          { subjectCode: 'MATH', teacherId: 'demo-teacher-primary' },
          { subjectCode: 'SCI', teacherId: 'demo-teacher-primary' },
        ],
        settings: {
          termYearInfo: `${yearObj.year} — ${yearObj.term}`,
          teacherName: 'MR. HECTOR ARYIKU',
          attendanceTotal: 64,
          nameFormat: 'LAST_FIRST',
          showProjectWork: true,
        },
      };

      const csRef = db.collection('classStreams').doc(classId);
      const scRef = db.collection('sais_classes').doc(classId);

      await chunker.set(csRef, classData, { merge: true });
      await chunker.set(scRef, classData, { merge: true });
    }
  }

  // 2. Parse 13 Active Student Registration CSVs and Seed Students
  let globalStudentCounter = 1;
  const registeredStudentsMap = new Map();
  const academicYearId = '2025-2026';
  const academicYear = '2025/2026';

  for (const cs of classStreamsList) {
    const filename = `STUDENTS_REGISTRATION_DATABASE_${cs.code}.csv`;
    const filePath = path.join(__dirname, '..', filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ Missing registration CSV: ${filename}`);
      continue;
    }

    const csvContent = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSVText(csvContent);

    if (rows.length < 2) continue;

    const headers = rows[0].map((h) => h.trim().toUpperCase());
    const idxFirst = headers.indexOf('FIRST NAME');
    const idxLast = headers.indexOf('LAST NAME');
    const idxOther = headers.indexOf('OTHER NAMES');
    const idxGender = headers.indexOf('GENDER');

    const classSlug = cs.code.replace(/_/g, '-');
    const classId = `${academicYearId}-${classSlug}`;
    const dataRows = rows.slice(1);

    console.log(`  📋 Processing ${cs.name} (${dataRows.length} registered students)...`);

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      const firstName = idxFirst !== -1 && row[idxFirst] ? row[idxFirst].trim() : '';
      const lastName = idxLast !== -1 && row[idxLast] ? row[idxLast].trim() : '';
      const otherNames = idxOther !== -1 && row[idxOther] ? row[idxOther].trim() : '';
      const gender = idxGender !== -1 && row[idxGender] ? row[idxGender].trim().toUpperCase() : 'M';

      if (!firstName && !lastName) continue;

      const studentKey = `SAIS-STU-${String(globalStudentCounter).padStart(4, '0')}`;
      const indexNo = String(rIdx + 1).padStart(3, '0');
      const fullName = otherNames ? `${lastName} ${firstName} ${otherNames}`.trim() : `${lastName} ${firstName}`.trim();

      const studentProfile = {
        id: studentKey,
        studentKey,
        studentId: studentKey,
        displayId: studentKey,
        legacyStudentId: studentKey,
        firstName,
        lastName,
        otherNames,
        fullName,
        name: fullName,
        gender: gender === 'M' || gender === 'MALE' ? 'Male' : 'Female',
        index: indexNo,
        indexNo,
        classId,
        currentClassStreamId: classId,
        academicYear,
        academicYearId,
        schoolId: 'sais-school-main',
        status: 'active',
        yearJoined: 2025,
        isHistoricalStub: false,
      };

      const stuRef = db.collection('students').doc(studentKey);
      const lifeRef = db.collection('sais_lifelongStudents').doc(studentKey);
      const saisStuRef = db.collection('sais_students').doc(studentKey);

      await chunker.set(stuRef, studentProfile, { merge: true });
      await chunker.set(lifeRef, studentProfile, { merge: true });
      await chunker.set(saisStuRef, studentProfile, { merge: true });

      const enrId = `enr-${studentKey.toLowerCase()}-2025-2026`;
      const enrRef = db.collection('sais_classEnrollments').doc(enrId);

      await chunker.set(enrRef, {
        id: enrId,
        studentId: studentKey,
        studentKey,
        legacyStudentId: studentKey,
        displayId: studentKey,
        classId,
        academicYear,
        academicYearId,
        className: cs.name,
        programme: getProgrammeForClass(cs.name),
        rollNumber: indexNo,
        index: indexNo,
        attendance: 64,
        enrolledTerms: ['T1', 'T2', 'T3'],
        formTeacherId: 'demo-teacher-primary',
        subjectTeacherIds: ['demo-teacher-primary'],
      }, { merge: true });

      registeredStudentsMap.set(fullName.toLowerCase(), studentProfile);
      registeredStudentsMap.set(studentKey.toLowerCase(), studentProfile);

      globalStudentCounter++;
    }
  }

  await chunker.commit();
  console.log(`✔ [STEP 2] Successfully registered ${globalStudentCounter - 1} active students across 13 class streams.`);
  return registeredStudentsMap;
}

/**
 * Normalized name token matching helper
 */
function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingStudent(csvName, registeredStudents) {
  const normTarget = normalizeName(csvName);
  if (!normTarget) return null;

  const nameFixes = {
    'akonor jeremy': 'akonnor jeremy',
  };

  const fixedTarget = nameFixes[normTarget] || normTarget;

  for (const s of registeredStudents.values()) {
    const sNormFull = normalizeName(s.fullName);
    const sNormStd = normalizeName(`${s.lastName} ${s.firstName}`);

    if (sNormFull === fixedTarget || sNormStd === fixedTarget) {
      return s;
    }

    const targetTokens = new Set(fixedTarget.split(' '));
    const studentTokens = new Set(sNormFull.split(' '));
    const intersection = [...targetTokens].filter((t) => studentTokens.has(t));

    if (intersection.length >= 2) {
      return s;
    }
  }
  return null;
}

let globalHistoricalStubCounter = 309;

async function resolveOrRegisterStudent(studentName, registeredStudents, chunker, academicYearId = '2025-2026', classId = '') {
  let matched = findMatchingStudent(studentName, registeredStudents);
  if (matched) return matched;

  const studentKey = `SAIS-STU-${String(globalHistoricalStubCounter).padStart(4, '0')}`;
  globalHistoricalStubCounter++;

  const cleanName = studentName.trim();
  const nameParts = cleanName.split(' ');
  const lastName = nameParts[0] || cleanName;
  const firstName = nameParts.slice(1).join(' ') || cleanName;

  const stubProfile = {
    id: studentKey,
    studentKey,
    studentId: studentKey,
    displayId: studentKey,
    legacyStudentId: studentKey,
    firstName,
    lastName,
    fullName: cleanName,
    name: cleanName,
    gender: 'Unknown',
    index: '999',
    indexNo: '999',
    classId,
    currentClassStreamId: classId,
    academicYear: academicYearId.replace('-', '/'),
    academicYearId,
    schoolId: 'sais-school-main',
    status: 'alumni',
    yearJoined: 2021,
    isHistoricalStub: true,
  };

  const stuRef = db.collection('students').doc(studentKey);
  const lifeRef = db.collection('sais_lifelongStudents').doc(studentKey);
  const saisStuRef = db.collection('sais_students').doc(studentKey);

  await chunker.set(stuRef, stubProfile, { merge: true });
  await chunker.set(lifeRef, stubProfile, { merge: true });
  await chunker.set(saisStuRef, stubProfile, { merge: true });

  registeredStudents.set(cleanName.toLowerCase(), stubProfile);
  registeredStudents.set(studentKey.toLowerCase(), stubProfile);

  console.log(`  ➕ Auto-registered historical alumni stub ${studentKey} for '${cleanName}'`);
  return stubProfile;
}

/**
 * STEP 3: RE-INGEST YEAR 5A MARKS TIED TO REGISTRY KEYS
 */
async function reingestYear5AMarks(chunker) {
  console.log('📊 [STEP 3] Re-ingesting Year 5A Marks (Terms 1, 2, 3) Tied to Registry Keys...');

  const classId = '2025-2026-YEAR-5A';
  const academicYear = '2025/2026';
  const academicYearId = '2025-2026';
  const classCode = 'YEAR-5A';

  const snap = await db.collection('students')
    .where('currentClassStreamId', '==', classId)
    .get();

  const y5aStudentsMap = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    y5aStudentsMap.set(data.studentKey.toLowerCase(), data);
    y5aStudentsMap.set(data.fullName.toLowerCase(), data);
  });
  console.log(`  Found ${snap.docs.length} registered students in Year 5A registry.`);

  const termFiles = [
    { termCode: 'T1', termNum: 1, termId: '2025-2026-T1', filename: 'YEAR 5A TERM 1 - REPORT DATA.csv', maxRows: 24 },
    { termCode: 'T2', termNum: 2, termId: '2025-2026-T2', filename: 'YEAR 5A TERM 2  - REPORT DATA.csv', maxRows: 25 },
    { termCode: 'T3', termNum: 3, termId: '2025-2026-T3', filename: 'YEAR 5A TERM 3 - REPORT DATA.csv', maxRows: 25 },
  ];

  const subjectsMap = [
    { code: 'ENG', name: 'English', cwHeader: 'ENG CW 20', mtHeader: 'ENG MT 20', eot60Header: 'ENG EOT 60', totalHeader: 'ENG EOT 100', gradeHeader: 'ENG GRADE', commentHeader: 'ENG COMMENT' },
    { code: 'MATH', name: 'Mathematics', cwHeader: 'MATH CW 20', mtHeader: 'MATH MT 20', eot60Header: 'MATH EOT 60', totalHeader: 'MATH EOT 100', gradeHeader: 'MATH GRADE', commentHeader: 'MATH COMMENT' },
    { code: 'FRE', name: 'French', cwHeader: 'FRE CW 20', mtHeader: 'FRE MT 20', eot60Header: 'FRE EOT 60', totalHeader: 'FRE EOT 100', gradeHeader: 'FRE GRADE', commentHeader: 'FRE COMMENT' },
    { code: 'ICT', name: 'Information & Comm Tech', cwHeader: 'ICT CW 20', mtHeader: 'ICT MT 20', eot60Header: 'ICT EOT 60', totalHeader: 'ICT EOT 100', gradeHeader: 'ICT GRADE', commentHeader: 'ICT COMMENT', altCw: 'I.C.T CW 20', altMt: 'I.C.T MT 20', altEot60: 'I.C.T EOT 60', altTotal: 'I.C.T EOT 100', altGrade: 'I.C.T GRADE', altComment: 'I.C.T COMMENT' },
    { code: 'SCI', name: 'Science', cwHeader: 'SCI CW 20', mtHeader: 'SCI MT 20', eot60Header: 'SCI EOT 60', totalHeader: 'SCI EOT 100', gradeHeader: 'SCI GRADE', commentHeader: 'SCI COMMENT' },
    { code: 'BK', name: 'Bible Knowledge', cwHeader: 'BK CW 20', mtHeader: 'BK MT 20', eot60Header: 'BK EOT 60', totalHeader: 'BK EOT 100', gradeHeader: 'BK GRADE', commentHeader: 'BK COMMENT' },
    { code: 'HUM', name: 'Humanities', cwHeader: 'HUM. CW 20', mtHeader: 'HUM. MT 20', eot60Header: 'HUM. EOT 60', totalHeader: 'HUM. EOT 100', gradeHeader: 'HUM. GRADE', commentHeader: 'HUM. COMMENT', altCw: 'HUM CW 20', altMt: 'HUM MT 20', altEot60: 'HUM EOT 60', altTotal: 'HUM EOT 100', altGrade: 'HUM GRADE', altComment: 'HUM COMMENT' },
    { code: 'MUSIC', name: 'Music', totalHeader: 'MUSIC EOT 100', gradeHeader: 'MUSIC GRADE', commentHeader: 'MUSIC COMMENT' },
    { code: 'PROJ', name: 'Project Work', totalHeader: 'PROJ EOT 100', gradeHeader: 'PROJ GRADE', commentHeader: 'PROJ COMMENT' },
  ];

  for (const tFile of termFiles) {
    const filePath = path.join(__dirname, '..', tFile.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ File not found: ${tFile.filename}, skipping.`);
      continue;
    }

    console.log(`  📄 Ingesting marks for Term ${tFile.termCode} from ${tFile.filename}...`);
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSVText(csvContent);

    if (rows.length < 2) continue;

    let headerRowIndex = rows.findIndex((r) => r.includes('STUDENT NAME') || r.includes('STUDENT ID'));
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headers = rows[headerRowIndex].map((h) => h.trim().toUpperCase());

    const getColIndex = (name, altName) => {
      const uName = name.toUpperCase();
      let idx = headers.indexOf(uName);
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
    const idxAttendance = getColIndex('ATTENDANCE');
    const idxRank = getColIndex('RANK');
    const idxGeneralComment = getColIndex("CLASS TEACHER'S COMMENT", "CLASS TEACHER’S COMMENT");
    const idxPeComment = getColIndex('PE COMMENT', 'PE T1');
    const idxClubComment = getColIndex('CLUB COMMENT', 'CLUB T1');
    const idxTeacherName = getColIndex("CLASS TEACHER'S NAME", "CLASS TEACHER’S NAME");

    const rawDataRows = rows.slice(headerRowIndex + 1);
    const dataRows = rawDataRows.slice(0, tFile.maxRows);

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      const studentName = idxName !== -1 ? row[idxName] : '';

      if (
        !studentName ||
        studentName.toUpperCase().includes('SAIS REPORT SYSTEM') ||
        studentName.toUpperCase().includes('PERFORMANCE CHART') ||
        studentName.toUpperCase().includes('#REF!') ||
        studentName.toUpperCase().includes('CLASS AVERAGE')
      ) continue;

      const matchedStudent = await resolveOrRegisterStudent(studentName, y5aStudentsMap, chunker, academicYearId, classId);

      const studentKey = matchedStudent.studentKey;
      const termKey = `${academicYear}_${tFile.termCode}`;
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

        subjectLines.push({ code: sub.code, name: sub.name, totalScore, grade });

        // Save deterministic mark key: ${termId}-${classCode}-${studentKey}-${sub.code}
        const scoreDocId = `${termId}-${classCode}-${studentKey}-${sub.code}`;
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
          academicYear,
          academicYearId,
          cwScore,
          mtScore,
          eotScore,
          totalScore,
          grade,
          comment,
        };

        const scoreRef = db.collection('sais_scores').doc(scoreDocId);
        const stuMarkRef = db.collection('studentMarks').doc(scoreDocId);

        await chunker.set(scoreRef, scoreData, { merge: true });
        await chunker.set(stuMarkRef, scoreData, { merge: true });
      }

      // Save Summary Doc with deterministic key: ${termId}-${classCode}-${studentKey}
      const rawScore = idxRawScore !== -1 && row[idxRawScore] ? Number(row[idxRawScore]) || 0 : 0;
      const averageScore = idxAveScore !== -1 && row[idxAveScore] ? Number(row[idxAveScore]) || 0 : 0;
      const aveGrade = idxAveGrade !== -1 && row[idxAveGrade] ? row[idxAveGrade] : 'U';
      const bestMark = idxBestMark !== -1 && row[idxBestMark] ? Number(row[idxBestMark]) || 0 : 0;
      const bestGrade = idxBestGrade !== -1 && row[idxBestGrade] ? row[idxBestGrade] : 'A';
      const leastMark = idxLeastMark !== -1 && row[idxLeastMark] ? Number(row[idxLeastMark]) || 0 : 0;
      const leastGrade = idxLeastGrade !== -1 && row[idxLeastGrade] ? row[idxLeastGrade] : 'U';
      const rank = idxRank !== -1 && row[idxRank] ? Number(row[idxRank]) || null : null;
      const generalComment = idxGeneralComment !== -1 && row[idxGeneralComment] ? row[idxGeneralComment] : '';
      const peComment = idxPeComment !== -1 && row[idxPeComment] ? row[idxPeComment] : '';
      const clubComment = idxClubComment !== -1 && row[idxClubComment] ? row[idxClubComment] : '';
      const teacherName = idxTeacherName !== -1 && row[idxTeacherName] ? row[idxTeacherName] : 'MR. HECTOR ARYIKU';

      const sumDocId = `${termId}-${classCode}-${studentKey}`;
      const sumRef = db.collection('sais_reportSummaries').doc(sumDocId);

      await chunker.set(sumRef, {
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
        academicYear,
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
        className: 'YEAR 5A',
        programme: 'PRIMARY',
        finalized: true,
        subjectLines,
      }, { merge: true });
    }
  }

  await chunker.commit();
  console.log('✔ Year 5A marks (Terms 1, 2, 3) successfully re-ingested into distinct term keys.');
}

async function main() {
  const isWipeRequested = process.argv.includes('--wipe');

  if (isWipeRequested) {
    await wipeExistingMatrix();
  }

  const chunker = new BatchChunker(db, 400);

  // STEP 2: Provision 13 streams and seed 308 active students
  await seedActiveStudentRegistry(chunker);

  // Commit student seeding before fetching for mark ingestion
  await chunker.commit();

  // STEP 3: Re-ingest Year 5A Marks tied to registry keys
  await reingestYear5AMarks(chunker);

  // Final Commit
  await chunker.commit();
  console.log('\n🎉 Master Student Registration Pipeline Executed Successfully!');
}

main().catch((err) => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});

module.exports = {
  wipeExistingMatrix,
  seedActiveStudentRegistry,
  reingestYear5AMarks,
};
