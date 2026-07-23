import { KEYS, LEGACY_STORAGE_KEYS, STORAGE_KEYS } from './collections';
import { EMPTY_SNAPSHOT, type DatabaseRepository, type SaisSnapshot, type SnapshotCollection } from './types';
import type { ClassEnrollment, LifelongStudent, ReportSummary } from '../types';

const READ_LATENCY_MS = Number(import.meta.env.VITE_FAKE_LATENCY_MS ?? 250);

function delay<T>(value: T, ms = READ_LATENCY_MS): Promise<T> {
  if (ms <= 0) return Promise.resolve(value);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function readRaw(key: string): string | null {
  try {
    const primary = localStorage.getItem(key);
    if (primary != null) return primary;
    const legacy = LEGACY_STORAGE_KEYS[key];
    if (!legacy) return null;
    const old = localStorage.getItem(legacy);
    if (old != null) {
      localStorage.setItem(key, old);
      localStorage.removeItem(legacy);
    }
    return old;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = readRaw(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const COLLECTION_TO_KEY: Record<SnapshotCollection, string> = {
  schools: KEYS.schools,
  users: KEYS.users,
  classes: KEYS.classes,
  lifelongStudents: KEYS.lifelong,
  enrollments: KEYS.enrollments,
  scores: KEYS.scores,
  summaries: KEYS.summaries,
  contacts: KEYS.contacts,
  subjectContexts: KEYS.subjectContexts,
  bannedTokens: KEYS.bannedTokens,
  activeClassId: KEYS.activeClass,
  keySeq: KEYS.keySeq,
};

export class LocalStorageRepository implements DatabaseRepository {
  async loadAll(): Promise<SaisSnapshot> {
    const snapshot: SaisSnapshot = {
      schools: readJson(KEYS.schools, []),
      users: readJson(KEYS.users, []),
      classes: readJson(KEYS.classes, []),
      lifelongStudents: readJson(KEYS.lifelong, []),
      enrollments: readJson(KEYS.enrollments, []),
      scores: readJson(KEYS.scores, []),
      summaries: readJson(KEYS.summaries, []),
      contacts: readJson(KEYS.contacts, []),
      subjectContexts: readJson(KEYS.subjectContexts, []),
      bannedTokens: readJson(KEYS.bannedTokens, []),
      activeClassId: readJson(KEYS.activeClass, null),
      keySeq: readJson(KEYS.keySeq, {}),
    };
    return delay(snapshot);
  }

  async saveCollection<K extends SnapshotCollection>(
    key: K,
    value: SaisSnapshot[K]
  ): Promise<void> {
    writeJson(COLLECTION_TO_KEY[key], value);
  }

  async replaceAll(snapshot: SaisSnapshot): Promise<void> {
    (Object.keys(COLLECTION_TO_KEY) as SnapshotCollection[]).forEach((k) => {
      writeJson(COLLECTION_TO_KEY[k], snapshot[k]);
    });
  }

  async clearAll(): Promise<void> {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    Object.values(LEGACY_STORAGE_KEYS).forEach((k) => {
      if (k) localStorage.removeItem(k);
    });
    await this.replaceAll(EMPTY_SNAPSHOT);
  }

  async getLifelongStudents(): Promise<LifelongStudent[]> {
    const all = await this.loadAll();
    return all.lifelongStudents;
  }

  async getEnrollmentsByStudentKey(studentKey: string): Promise<ClassEnrollment[]> {
    const all = await this.loadAll();
    return all.enrollments.filter((e) => e.studentKey === studentKey);
  }

  async getSummariesByStudentId(studentId: string): Promise<ReportSummary[]> {
    const all = await this.loadAll();
    return all.summaries.filter((s) => s.studentId === studentId);
  }

  async upsertSummary(summary: ReportSummary): Promise<void> {
    const all = await this.loadAll();
    const key = `${summary.studentId}|${summary.academicYear}|${summary.termKey}|${summary.mode}`;
    const next = [...all.summaries];
    const idx = next.findIndex(
      (s) => `${s.studentId}|${s.academicYear}|${s.termKey}|${s.mode}` === key
    );
    if (idx >= 0) next[idx] = summary;
    else next.push(summary);
    await this.saveCollection('summaries', next);
  }
}

/** Singleton used by DatabaseProvider — swap for FirestoreRepository later */
export const localRepository = new LocalStorageRepository();
