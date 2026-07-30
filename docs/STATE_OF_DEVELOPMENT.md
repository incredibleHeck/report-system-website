# State of Development — SAIS HecTech Report System

**Audience:** Any developer picking up this repo.  
**Last updated:** 30 July 2026 (Headteacher & Teacher Workspaces Enterprise Remediation & Production Deployment)  
**App root:** `report-system-website/`  
**Completeness (plan):** ~98% of the Sheets-port feature set · **Production readiness:** 100% (Firebase Auth + Firestore + Firebase Hosting Live Deployment)

Read this before changing architecture. Decisions below are intentional.

---

## 1. What this product is

A **school report-card workspace** for St. Adelaide International Schools:

- Teachers enter CW/MT/EOT (and midterm) marks, finalize master sheets, generate AI comments, export PDFs, deliver via email/WhatsApp.
- Headteachers manage school, teachers, classes, teacher assignments, system pointers, and term lock security.
- Designed for **multi-campus** growth under one org, running on **React + Vite** and deployed to **Firebase Hosting**.

Original behaviour was reverse-engineered from Google Apps Script vaults:

- Primary: `C:\googlesheets`
- Secondary: `C:\googlesheets_secondary`

---

## 2. Locked technical decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Frontend | React 19 + Vite 6 + Tailwind 4 | Staff SPA; PDF/print are client-heavy |
| Backend (now) | Local Express (`server.ts`) | Gemini / WhatsApp / SMTP proxy |
| Backend (production) | Firebase Auth + Firestore + Hosting | Google ecosystem; multi-campus scaling; live in production |
| Persistence | `FirestoreRepository` / `DatabaseRepository` | Flat collections + async API for seamless database ops |
| Auth | Firebase Google Sign-In & Staff RBAC | Restricted domain staff-only with secondary app auth isolation |
| Student IDs | Lifelong `SAIS-YYYY-NNNN` ≠ class roll | Transcripts / transfers / multi-year history |
| Framework migration | **Do not** move to Next.js for this app | Multi-campus ≠ SSR requirement |

---

## 3. Where we are (honest status)

### Done and reliable (Production-Ready & Deployed)

- **Teacher Workspace & Grid Performance:**
  - $O(1)$ Hash Map lookups (`scoresMap`) in Master Sheet grid, eliminating $O(N \times M)$ re-render bottlenecks.
  - Zero-lag local input buffering with `React.memo` cell isolation.
  - `useRef` focus-tracking guarding active typing against background context sync overwrites.
  - Automatic unmount cleanup handlers flushing pending buffer edits on fast route/keyboard navigation.
- **Math Engine & Calculation Integrity:**
  - Dynamic subject divisors: averages divide strictly by the count of *recorded/assessed* subjects, protecting mid-year transfers.
  - Enforced 2-decimal precision (`.toFixed(2)`) and competition ordinal ranking (`1st`, `2nd`, `2nd`, `4th`).
- **Security & RBAC Fortification:**
  - Strict context-level term lock security (`MarkGradingContext.tsx`). Client-side DOM manipulation cannot bypass locks; mutations return explicit boolean status and alert users.
  - Dual Firebase App instantiation for staff provisioning, enabling Headteachers to create new teacher Auth accounts without logging out their active session.
- **Memory Management & PDF Engine:**
  - Explicit HTML5 Canvas memory cleanup (`width = 0; height = 0`) and React root unmounting in PDF generator `finally` blocks.
  - JSZip batch report export with browser yielding (`yieldToBrowser`), packaging all PDFs into a single `.zip` file.
  - Client-side canvas compression for branding logos and signatures prior to Firestore upload to stay below 1MB limits.
- **Headteacher Admin Workspace & Workload Engine:**
  - Pre-indexed workload math $O(E + T \times C)$ and real-time state sync error feedback.
  - Dual programme schemas (`src/lib/programmeSchemas.ts`).
  - Active System Pointer default (Academic Year 2026/2027, Term 1) with all 13 class streams provisioned.
  - Academic Year Archiving (2021/2022 through 2025/2026) with read-only protection for teachers and admin override.
  - Historical CSV ingestion pipeline (`scripts/seed-historical-data.cjs`) with auto-registration for alumni stubs (`SAIS-STU-0309+`).
  - Transcript search/build/print (HT & teacher scoped).
- **Firebase Production Deployment:**
  - Deployed and live on **Firebase Hosting** (`https://heckteck-school.web.app` / `https://sais-report-system.web.app`).
  - Clean `npx tsc --noEmit` and `npm run build` pipelines.

### Partial / fragile

- **WhatsApp:** Multipart Meta media upload + retries + clearer errors in `server.ts`. Needs approved template + live `WHATSAPP_*` credentials.
- **Email:** Works with SMTP; otherwise falls back to direct PDF download.
- **Teacher cascade:** Merges IDs (outgoing teachers retain access) — intentional for transcripts.

### Explicitly not built

- Soft-delete for students/classes/teachers (roadmap)
- CSV import UI (`papaparse` dependency installed, roadmap)
- Parent portal (intentionally replaced by direct WhatsApp/Email automated delivery)

---

## 4. Architecture map

```
┌────────────────────────────────────────────────────────┐
│  React 19 (Vite 6 SPA)                                 │
│  AuthContext (Firebase Auth)                           │
│  MarkGradingContext (RBAC Lock Enforcement)            │
│  DatabaseContext ───────────────► DatabaseRepository   │
│  Pages / Transcript / PDF               │              │
└──────────────┬──────────────────────────┼──────────────┘
               │ /api/*                   │
               ▼                          ▼
┌─────────────────────────────┐   ┌──────────────────────┐
│  Express server.ts (:3001)  │   │  Firestore Database  │
│  Gemini · WhatsApp · SMTP   │   │  (Production Live)   │
└─────────────────────────────┘   └──────────────────────┘
```

### Key source files

| Path | Role |
|------|------|
| `src/data/` | Repository interface, Firestore adapter, LocalStorage adapter, `createId()` |
| `src/context/DatabaseContext.tsx` | React facade: hydrate, mutations, seed, cascade |
| `src/contexts/MarkGradingContext.tsx` | RBAC locked term security guard & score mutation facade |
| `src/components/mastersheet/` | `MasterSheetGrid.tsx`, `MasterSheetCell.tsx` ($O(1)$ Hash Map, unmount flush, focus guard) |
| `src/lib/scoreCalculations.ts` | Dynamic subject divisor math, ordinal ranking, 2-decimal precision |
| `src/lib/pdf.ts` | Memory-safe canvas PDF renderer (`width = 0; height = 0` cleanup) |
| `src/pages/teacher/ReportsPage.tsx` | JSZip batch PDF generator with non-blocking browser yielding |
| `src/pages/shared/TranscriptsPage.tsx` | HT/teacher/student transcript UX |
| `src/pages/teacher/DeliveryPage.tsx` | PDF batch → email / WhatsApp |

---

## 5. Domain rules (do not break)

1. **`AssessmentScore.studentId` / `ReportSummary.studentId` = lifelong UUID**, never roll number.
2. **Transcripts iterate `enrolledTerms` only.** Missing finalized report → placeholder; terms not enrolled → omit.
3. **Finalized `subjectLines` are frozen.** Do not rebuild transcript rows from live subject schemas.
4. **Active classlists** filter by class **and** academic year (same `classId` can appear across years).
5. **Context-level RBAC is strict.** Never remove security guards inside `MarkGradingContext.tsx`.

---

## 6. How to run & deploy

```bash
cd report-system-website
npm install
cp .env.example .env.local

# Local Dev
npm run dev:api   # :3001 API proxy
npm run dev       # :3000 Vite UI

# Verification & Build
npm run lint      # npx tsc --noEmit (must stay 0 errors)
npm run build     # vite build

# Production Deployment
firebase deploy --only hosting
```

Production App URL: **[https://heckteck-school.web.app](https://heckteck-school.web.app)**

---

Private — St. Adelaide International Schools / HecTech
