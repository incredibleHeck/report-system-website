# State of Development — SAIS HecTech Report System

**Audience:** Any developer picking up this repo.  
**Last updated:** 30 July 2026 (Headteacher Workspace Codebase Audit & Remediation)  
**App root:** `report-system-website/`  
**Completeness (plan):** ~93% of the Sheets-port feature set · **Production readiness:** ~42% (demo auth + localStorage)

Read this before changing architecture. Decisions below are intentional.

---

## 1. What this product is

A **school report-card workspace** for St. Adelaide International Schools:

- Teachers enter CW/MT/EOT (and midterm) marks, finalize master sheets, generate AI comments, export PDFs, deliver via email/WhatsApp.
- Headteachers manage school, teachers, classes, and teacher assignments.
- Designed for **multi-campus** growth under one org, still on **React + Vite** (not Next.js).

Original behaviour was reverse-engineered from Google Apps Script vaults:

- Primary: `C:\googlesheets`
- Secondary: `C:\googlesheets_secondary`

---

## 2. Locked technical decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Frontend | React 19 + Vite 6 + Tailwind 4 | Staff SPA; PDF/print are client-heavy |
| Backend (now) | Local Express (`server.ts`) | Gemini / WhatsApp / SMTP without Blaze card yet |
| Backend (later) | Firebase Auth + Firestore + Cloud Functions + Hosting | Google ecosystem; multi-campus; &lt;1k students fits free tier (Functions need Blaze to *deploy*) |
| Persistence (now) | `FirestoreRepository` | Flat collections + async API so Firestore swap is days, not weeks |
| Auth (now) | Firebase Google Sign-In | Restricted domain staff-only |
| Student IDs | Lifelong `SAIS-YYYY-NNNN` ≠ class roll | Transcripts / transfers / multi-year history |
| Framework migration | **Do not** move to Next.js for this app | Multi-campus ≠ SSR requirement |

---

## 3. Where we are (honest status)

### Done and reliable

- Headteacher Admin Workspace Diagnostic Audit & Remediation (Auth error aborting, workload math pre-indexing $O(E + T \times C)$, state sync error toasts)
- Dual programme schemas (`src/lib/programmeSchemas.ts`)
- Active System Pointer default (Academic Year 2026/2027, Term 1) with all 13 class streams provisioned
- Academic Year Archiving (2021/2022 through 2025/2026) with read-only protection for teachers and admin override
- Master Sheet & Subject Sheet multi-term query resolution matching normalized term keys (hyphenated, slashed, underscore)
- Historical CSV ingestion pipeline (`scripts/seed-historical-data.cjs`) with auto-registration for alumni stubs (`SAIS-STU-0309+`)
- Score upsert keyed by student|subject|mode|termKey; year-safe `termKey`
- Lifelong students + class enrollments + `enrolledTerms`
- Finalize freezes `subjectLines`; unfinalize clears snapshot aggregates
- Teacher workspace routes + AI suite + PDF reports
- Delivery page uses correct EOT vs Midterm cards
- Transcript search/build/print (HT, teacher scoped)
- Classlist: add new, enroll existing, join-term, transfer trim
- Phase 0 data layer: `src/data/*` + HT teacher reassignment UI
- `npx tsc --noEmit` clean

### Partial / fragile

- **WhatsApp:** Multipart Meta media upload + retries + clearer errors in `server.ts`. Still needs approved template + live `WHATSAPP_*` credentials. No inbound delivery webhooks yet.
- **Email:** works with SMTP; otherwise download fallback
- **Master unfinalize UI:** API clears full snapshot; button currently targets first student only
- **Teacher cascade:** merges IDs (outgoing teachers retain access) — intentional for transcripts; can over-broaden scope

### Explicitly not built

- Soft-delete for students/classes/teachers
- CSV import (dependency `papaparse` present, unused)
- Entity admin beyond create + reassign
- Parent portal (intentionally replaced by WhatsApp/Email automated delivery)
- WhatsApp delivery status webhooks / outbox queue

---

## 4. Architecture map

```
┌─────────────────────────────┐
│  React (Vite :3000)         │
│  AuthContext (Firebase)     │
│  DatabaseContext ───────────│──► DatabaseRepository
│  Pages / Transcript / PDF   │         │
└──────────────┬──────────────┘         ▼
               │ /api/*          FirestoreRepository
               ▼                 
┌─────────────────────────────┐
│  Express server.ts (:3001)  │
│  Gemini · WhatsApp · SMTP   │
└─────────────────────────────┘

Future:
  server.ts             → Cloud Functions (+ Hosting rewrite)
```

### Key source files

| Path | Role |
|------|------|
| `src/data/` | Repository interface, local adapter, collection keys, `createId()` |
| `src/context/DatabaseContext.tsx` | React facade: hydrate, mutations, seed, cascade |
| `src/lib/academicYear.ts` | Year / termKey / studentKey helpers |
| `src/lib/transcript.ts` | Async search + buildTranscript (no live curriculum joins) |
| `src/lib/reportMath.ts` | Summaries + `subjectLines` at finalize |
| `src/pages/shared/TranscriptsPage.tsx` | HT/teacher/student transcript UX |
| `src/pages/teacher/DeliveryPage.tsx` | PDF batch → email / WhatsApp |
| `server.ts` | Secret-bearing integrations |

### Storage keys (flat collections)

| Key | Collection |
|-----|------------|
| `sais_lifelongStudents` | Lifelong identities |
| `sais_classEnrollments` | Per-year class membership |
| `sais_reportSummaries` | Finalized / draft report aggregates |
| `sais_scores` | Assessment scores |
| `sais_schools` / `sais_users` / `sais_classes` | Org shell |
| `sais_contacts` | Parent phone/email + delivery status |

Legacy keys (`sais_lifelong`, `sais_enrollments`, `sais_summaries`) are migrated on read.

Fake read latency: `VITE_FAKE_LATENCY_MS` (default 250). App shows a loading gate until hydrate completes.

---

## 5. Domain rules (do not break)

1. **`AssessmentScore.studentId` / `ReportSummary.studentId` = lifelong UUID**, never roll number.  
   Roll lives on enrollment / `Student.studentId` view field only.
2. **Transcripts iterate `enrolledTerms` only.** Missing finalized report → placeholder; terms not enrolled → omit.
3. **Finalized `subjectLines` are frozen.** Do not rebuild transcript rows from live subject schemas.
4. **Active classlists** filter by class **and** academic year (same `classId` can appear across years).
5. Prefer extending `DatabaseRepository` over writing `localStorage` directly in pages.

---

## 6. How to run (day one)

```bash
cd report-system-website
npm install
cp .env.example .env.local
# Optional: GEMINI_API_KEY, WhatsApp, SMTP

npm run dev:api   # :3001
npm run dev       # :3000
```

Smoke path after **Load SAIS Demo Data**:

1. Teacher → marks → Master → Finalize  
2. Transcripts → `BOATENG` → `SAIS-2023-0042`  
3. Headteacher → reassign a subject teacher  

```bash
npm run lint   # must stay clean
```

---

## 7. What to build next (priority order)

Aligned with plan [`firebase_high_impact_next_steps_sais.plan.md`](../../.cursor/plans/firebase_high_impact_next_steps_sais.plan.md) (path may vary on your machine):

| Priority | Work | Notes |
|----------|------|-------|
| ~~1~~ | ~~Delivery ZIP + WhatsApp harden~~ | **Done** — class ZIP with yield/progress; multipart WA upload + retries |
| ~~4~~ | ~~Firebase foundation~~ | **Done** — Auth + Firestore schema + security rules |
| ~~5~~ | ~~`FirestoreRepository`~~ | **Done** |
| 1 | Soft-delete + archive UX | Through repository; keep finalized history |
| 2 | CSV import | Use existing `papaparse`; classlist + scores |
| 3 | WhatsApp webhooks / outbox | Delivered/failed status callbacks |
| 6 | Functions + Hosting | Port `server.ts`; Blaze required to deploy Functions |

**Do not** start a Next.js migration or nested “scores inside student” storage.

---

## 8. Demo seed cheat sheet

After **Load SAIS Demo Data**:

| Entity | Value |
|--------|--------|
| Lifelong key | `SAIS-2023-0042` — BOATENG AMA (multi-year) |
| Mid-year joiner | ASANTE ESI — enrolled `T2`,`T3` |
| Withdrawal | QUAYE NII — enrolled `T1` only |
| Teachers | Akosua Mensah (Primary), Kwame Asante (Secondary) |
| Classes | YEAR FIVE (A), YEAR NINE (A), YEAR FOUR (B) |

Clearing browser localStorage (or using a private window) avoids stale pre-migration data. Prefer **Seed Demo** again after pulls that change collection keys.

---

## 9. Known pitfalls

- **Identity mix-ups:** view model `Student.id` = lifelong id; `Student.studentId` = roll. New pages must use the right field for scores/summaries.
- **Strict Mode double mount:** hydrate runs twice in dev; repository writes are idempotent — don’t “fix” by adding sync `localStorage` in components.
- **WhatsApp without Meta setup:** will not send; treat as optional until Business + template approved.
- **PDF timing:** offscreen `createRoot` + short timeout — flaky if logo/fonts load slowly; increase delay carefully if reports are blank.
- **Cascade merge:** reassignment never removes old teacher IDs from `subjectTeacherIds` (historical access).

---

## 10. Definition of done for the next contributor

A good handoff PR should:

- [ ] Keep `npm run lint` (`tsc --noEmit`) green  
- [ ] Touch data only via `DatabaseRepository` / `DatabaseContext`  
- [ ] Preserve lifelong UUID on scores/summaries  
- [ ] Update this file’s **Last updated** + section 3/7 if status changes  
- [ ] Update root `README.md` feature table if user-facing capability changes  

---

## 11. Contacts / ownership

- Product: SAIS HecTech report workflow  
- Repo workspace: `c:\Users\me\reportsystem\report-system-website`  
- Related audit canvas (Cursor): `project-completeness-audit.canvas.tsx` under the Cursor projects canvases folder  

When in doubt: **lean local demo that acts like Firestore**, keep Express until Blaze is acceptable, ship school ops (delete / ZIP / WhatsApp / CSV) on the repository, then flip persistence to Firebase.
