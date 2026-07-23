import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { STORAGE_KEYS } from './collections';
import type { DatabaseRepository, SaisSnapshot, SnapshotCollection } from './types';
import type { ClassEnrollment, LifelongStudent, ReportSummary } from '../types';

const COLLECTION_MAP: Record<SnapshotCollection, string> = {
  schools: STORAGE_KEYS.schools,
  users: STORAGE_KEYS.users,
  classes: STORAGE_KEYS.classes,
  lifelongStudents: STORAGE_KEYS.lifelongStudents,
  enrollments: STORAGE_KEYS.classEnrollments,
  scores: STORAGE_KEYS.scores,
  summaries: STORAGE_KEYS.reportSummaries,
  contacts: STORAGE_KEYS.contacts,
  subjectContexts: STORAGE_KEYS.subjectContexts,
  bannedTokens: STORAGE_KEYS.bannedTokens,
  activeClassId: STORAGE_KEYS.activeClass,
  keySeq: STORAGE_KEYS.keySeq,
};

export class FirestoreRepository implements DatabaseRepository {
  private async loadCollection<T>(path: string): Promise<T[]> {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
  }

  async loadAll(): Promise<SaisSnapshot> {
    const [
      schools,
      users,
      classes,
      lifelongStudents,
      enrollments,
      scores,
      summaries,
      contacts,
      subjectContexts,
      bannedTokens,
      activeClassIdDocs,
      keySeqDocs,
    ] = await Promise.all([
      this.loadCollection<any>(COLLECTION_MAP.schools),
      this.loadCollection<any>(COLLECTION_MAP.users),
      this.loadCollection<any>(COLLECTION_MAP.classes),
      this.loadCollection<any>(COLLECTION_MAP.lifelongStudents),
      this.loadCollection<any>(COLLECTION_MAP.enrollments),
      this.loadCollection<any>(COLLECTION_MAP.scores),
      this.loadCollection<any>(COLLECTION_MAP.summaries),
      this.loadCollection<any>(COLLECTION_MAP.contacts),
      this.loadCollection<any>(COLLECTION_MAP.subjectContexts),
      this.loadCollection<any>(COLLECTION_MAP.bannedTokens),
      this.loadCollection<any>(COLLECTION_MAP.activeClassId),
      this.loadCollection<any>(COLLECTION_MAP.keySeq),
    ]);

    return {
      schools,
      users,
      classes,
      lifelongStudents,
      enrollments,
      scores,
      summaries,
      contacts,
      subjectContexts,
      bannedTokens,
      activeClassId: activeClassIdDocs[0]?.value ?? null,
      keySeq: keySeqDocs[0]?.value ?? {},
    };
  }

  async saveCollection<K extends SnapshotCollection>(
    key: K,
    value: SaisSnapshot[K]
  ): Promise<void> {
    const path = COLLECTION_MAP[key];

    if (key === 'activeClassId' || key === 'keySeq') {
      const docRef = doc(db, path, 'singleton');
      await setDoc(docRef, { value });
      return;
    }

    const items = value as any[];
    for (let i = 0; i < items.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 500);
      for (const item of chunk) {
        let docId = item.id;
        if (!docId) {
          if (key === 'bannedTokens') {
            docId = `${item.studentId}_${item.classId}_${item.termKey}`;
          } else if (key === 'subjectContexts') {
            docId = `${item.classId}_${item.subjectCode}`;
          } else {
            docId = 'unknown';
          }
        }
        const docRef = doc(db, path, docId);
        batch.set(docRef, item);
      }
      await batch.commit();
    }
  }

  async replaceAll(snapshot: SaisSnapshot): Promise<void> {
    const keys = Object.keys(COLLECTION_MAP) as SnapshotCollection[];
    await Promise.all(keys.map((key) => this.saveCollection(key, snapshot[key])));
  }

  async clearAll(): Promise<void> {
    console.warn('clearAll is not fully implemented in FirestoreRepository to prevent accidental data deletion.');
  }

  async getLifelongStudents(): Promise<LifelongStudent[]> {
    return this.loadCollection<LifelongStudent>(COLLECTION_MAP.lifelongStudents);
  }

  async getEnrollmentsByStudentKey(studentKey: string): Promise<ClassEnrollment[]> {
    const q = query(
      collection(db, COLLECTION_MAP.enrollments),
      where('studentKey', '==', studentKey)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ClassEnrollment);
  }

  async getSummariesByStudentId(studentId: string): Promise<ReportSummary[]> {
    const q = query(
      collection(db, COLLECTION_MAP.summaries),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ReportSummary);
  }

  async upsertSummary(summary: ReportSummary): Promise<void> {
    const docRef = doc(db, COLLECTION_MAP.summaries, summary.id);
    await setDoc(docRef, summary);
  }
}
