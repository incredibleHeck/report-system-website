const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkYear6() {
  const snap = await db.collection('students').get();
  const allStudents = snap.docs.map(d => d.data());

  const enrSnap = await db.collection('sais_classEnrollments').get();
  const allEnrollments = enrSnap.docs.map(d => d.data());

  console.log('\n--- 2025-2026 YEAR 6A ENROLLMENTS ---');
  const enr6A = allEnrollments.filter(e => e.classId === '2025-2026-YEAR-6A');
  for (const e of enr6A) {
    const st = allStudents.find(s => s.studentKey === e.studentKey);
    console.log(`Key: ${e.studentKey} | Index: ${e.index} | Name: ${st ? st.name : 'Unknown'}`);
  }

  console.log('\n--- 2025-2026 YEAR 6B ENROLLMENTS ---');
  const enr6B = allEnrollments.filter(e => e.classId === '2025-2026-YEAR-6B');
  for (const e of enr6B) {
    const st = allStudents.find(s => s.studentKey === e.studentKey);
    console.log(`Key: ${e.studentKey} | Index: ${e.index} | Name: ${st ? st.name : 'Unknown'}`);
  }
}

checkYear6().catch(console.error);
