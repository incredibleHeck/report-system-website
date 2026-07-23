import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Load your service account key
// WARNING: Ensure service-account.json is in your .gitignore!
const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function seedDatabase() {
  console.log('🌱 Starting Firestore seed...');
  const batch = db.batch();

  try {
    // 1. Seed Lifelong Student
    const studentRef = db.collection('sais_lifelongStudents').doc('demo-student-id');
    batch.set(studentRef, {
      studentKey: 'SAIS-2023-0042',
      name: 'Amankwah, Zoe',
      gender: 'Female',
      yearJoined: '2023',
      status: 'active'
    });

    // 2. Seed Class Enrollment
    const enrollmentRef = db.collection('sais_classEnrollments').doc('demo-enrollment-id');
    batch.set(enrollmentRef, {
      studentId: 'demo-student-id',
      studentKey: 'SAIS-2023-0042',
      classId: 'class-year-5',
      academicYear: '2025_2026',
      className: 'Year 5 (A)',
      programme: 'PRIMARY',
      rollNumber: 'SAISDAN05A025',
      enrolledTerms: ['T1', 'T2', 'T3']
    });

    // 3. Seed Staff Users in sais_users
    const admins = [
      { id: 'user-hector-1', name: 'Hector Aryiku', email: 'hectoraryiku@stadelaideschool.com' },
      { id: 'user-hector-2', name: 'Hector Aryiku', email: 'hectoraryiku@stadelaideshool.com' },
      { id: 'user-bertinus', name: 'Bertinus Baalu', email: 'bertinusbaalu@stadelaideschool.com' },
      { id: 'user-prince', name: 'Prince Dunyoh', email: 'princedunyoh@stadelaideschool.com' },
      { id: 'user-theodora', name: 'Theodora Hammond', email: 'theodorahammond@stadelaideschool.com' }
    ];

    admins.forEach((admin) => {
      const ref = db.collection('sais_users').doc(admin.id);
      batch.set(ref, {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'headteacher',
        schoolId: 'demo-school-id'
      });
    });

    // Commit the batch
    await batch.commit();
    console.log('✅ Database successfully seeded!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
