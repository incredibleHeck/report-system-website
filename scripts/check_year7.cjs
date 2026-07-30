const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkYear7() {
  const snap = await db.collection('students').get();
  const allStudents = snap.docs.map(d => d.data());

  const enrSnap = await db.collection('sais_classEnrollments').get();
  const allEnrollments = enrSnap.docs.map(d => d.data());

  console.log('\n--- 2025-2026 YEAR 7 ENROLLMENTS ---');
  const enr7 = allEnrollments.filter(e => e.classId === '2025-2026-YEAR-7');
  enr7.sort((a, b) => a.index.localeCompare(b.index));
  for (const e of enr7) {
    const st = allStudents.find(s => s.studentKey === e.studentKey);
    console.log(`Key: ${e.studentKey} | Index: ${e.index} | Name: ${st ? st.name : 'Unknown'}`);
  }
}

checkYear7().catch(console.error);
