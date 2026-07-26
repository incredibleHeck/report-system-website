import {
  collection,
  doc,
  getDocs,
  getDoc,
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

// --- IDB Wrapper for Local Caching ---
const DB_NAME = 'SaisLocalCache';
const STORE_NAME = 'snapshot_cache';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB get error:', err);
    return undefined;
  }
}

async function idbSet<T>(key: string, val: T): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB set error:', err);
  }
}

export class FirestoreRepository implements DatabaseRepository {
  private inMemorySnapshot: Partial<SaisSnapshot> = {};
  private inMemoryMaps: Partial<Record<SnapshotCollection, Map<string, any>>> = {};

  private async loadCollection<T>(path: string): Promise<T[]> {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
  }

  private buildMap(key: SnapshotCollection, items: any[]) {
    const map = new Map<string, any>();
    if (!items) return;
    for (const item of items) {
      if (key === 'activeClassId' || key === 'keySeq') {
        map.set('singleton', item);
      } else {
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
        map.set(docId, item);
      }
    }
    this.inMemoryMaps[key] = map;
  }

  async loadAll(): Promise<SaisSnapshot> {
    // 1. Fetch system/metadata to get granular timestamps
    let remoteMetadata: Record<string, number> = {};
    try {
      const metaSnap = await getDoc(doc(db, 'system', 'metadata'));
      if (metaSnap.exists()) {
        remoteMetadata = metaSnap.data() as Record<string, number>;
      }
    } catch (err) {
      console.warn("Could not fetch system/metadata, will bypass cache", err);
    }

    const localMetadata = await idbGet<Record<string, number>>('metadata') || {};
    const localSnapshot = await idbGet<SaisSnapshot>('snapshot') || {};

    const result: Partial<SaisSnapshot> = {};
    const collectionsToFetch: SnapshotCollection[] = [];
    const keys = Object.keys(COLLECTION_MAP) as SnapshotCollection[];
    
    // Determine which collections need fetching
    for (const key of keys) {
      const remoteTime = remoteMetadata[`lastUpdated_${key}`] || 0;
      const localTime = localMetadata[`lastUpdated_${key}`] || -1;

      if (localSnapshot[key] && localTime >= remoteTime) {
        // Cache hit
        result[key] = localSnapshot[key];
      } else {
        // Cache miss
        collectionsToFetch.push(key);
      }
    }

    // Fetch missing collections
    if (collectionsToFetch.length > 0) {
      const fetchPromises = collectionsToFetch.map(key => this.loadCollection<any>(COLLECTION_MAP[key]));
      const fetchedData = await Promise.all(fetchPromises);

      for (let i = 0; i < collectionsToFetch.length; i++) {
        const key = collectionsToFetch[i];
        const data = fetchedData[i];
        if (key === 'activeClassId' || key === 'keySeq') {
          result[key] = data[0]?.value ?? (key === 'activeClassId' ? null : {});
        } else {
          result[key] = data;
        }
        localMetadata[`lastUpdated_${key}`] = remoteMetadata[`lastUpdated_${key}`] || Date.now();
      }
    }

    const finalSnapshot = result as SaisSnapshot;
    
    // Save back to IDB
    await idbSet('snapshot', finalSnapshot);
    await idbSet('metadata', localMetadata);

    this.inMemorySnapshot = finalSnapshot;
    for (const key of keys) {
      this.buildMap(
        key, 
        key === 'activeClassId' || key === 'keySeq' 
          ? [{ value: finalSnapshot[key] }] 
          : (finalSnapshot[key] as any[])
      );
    }

    return finalSnapshot;
  }

  async saveCollection<K extends SnapshotCollection>(
    key: K,
    value: SaisSnapshot[K]
  ): Promise<void> {
    const path = COLLECTION_MAP[key];
    const map = this.inMemoryMaps[key] || new Map<string, any>();
    
    let hasChanges = false;

    if (key === 'activeClassId' || key === 'keySeq') {
      const oldVal = map.get('singleton')?.value;
      if (JSON.stringify(oldVal) !== JSON.stringify(value)) {
        await setDoc(doc(db, path, 'singleton'), { value }, { merge: true });
        map.set('singleton', { value });
        hasChanges = true;
      }
    } else {
      const items = value as any[];
      const newMap = new Map<string, any>();
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const item of items) {
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
        newMap.set(docId, item);

        const oldItem = map.get(docId);
        // O(1) diffing.
        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
          const docRef = doc(db, path, docId);
          batch.set(docRef, item, { merge: true });
          batchCount++;
          hasChanges = true;
          if (batchCount === 490) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      this.inMemoryMaps[key] = newMap;
    }

    if (this.inMemorySnapshot) {
      this.inMemorySnapshot[key] = value;
      await idbSet('snapshot', this.inMemorySnapshot);
    }

    if (hasChanges) {
      const now = Date.now();
      try {
        await setDoc(doc(db, 'system', 'metadata'), { [`lastUpdated_${key}`]: now }, { merge: true });
        const localMetadata = await idbGet<Record<string, number>>('metadata') || {};
        localMetadata[`lastUpdated_${key}`] = now;
        await idbSet('metadata', localMetadata);
      } catch (err) {
        console.warn("Failed to update system metadata", err);
      }
    }
  }

  async replaceAll(snapshot: SaisSnapshot): Promise<void> {
    const keys = Object.keys(COLLECTION_MAP) as SnapshotCollection[];
    for (const key of keys) {
      await this.saveCollection(key, snapshot[key]);
    }
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
    await setDoc(docRef, summary, { merge: true });
  }
}
