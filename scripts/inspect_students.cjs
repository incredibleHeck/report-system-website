const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function inspect() {
  const snap = await db.collection('students').get();
  console.log(`Total students in Firestore: ${snap.size}`);
  
  const classSnap = await db.collection('sais_classes').get();
  console.log(`Total classes in Firestore: ${classSnap.size}`);
  for (const doc of classSnap.docs) {
    const data = doc.data();
    if (data.name.includes('6A') || data.name.includes('6B')) {
      console.log(`Class: ${doc.id} -> ${data.name} (${data.academicYear})`);
    }
  }

  const enrollSnap = await db.collection('sais_classEnrollments').get();
  console.log(`Total class enrollments in Firestore: ${enrollSnap.size}`);
}

inspect().catch(console.error);
