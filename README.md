# SAIS HecTech — Web Report System

React + Vite web port of the **St. Adelaide International Schools (SAIS)** HecTech AI report-card workflow (Primary + Secondary). Source of truth for grading behaviour was the Google Sheets vaults at `C:\googlesheets` (Primary) and `C:\googlesheets_secondary` (Secondary).

**Stack decision (locked):** Stay on **React + Vite**. Production deployment is live on **Firebase + Google** (Auth, Firestore, Hosting, Gemini) — not Next.js. Multi-campus is a data/auth concern, not a framework rewrite.

> Incoming developers: start with [`docs/STATE_OF_DEVELOPMENT.md`](docs/STATE_OF_DEVELOPMENT.md) for status, architecture, and production readiness guidelines.

---

## Features (current)

| Area | Status |
|------|--------|
| Primary / Secondary programme schemas (CW/MT/EOT, Music, Project Term 3, PE/Club) | Done |
| Active System Pointer (2026/2027 Term 1) & 13 Class Stream Provisioning | Done |
| Academic Year Archiving (2021–2026) with RBAC Read-Only Locks & HT Override | Done |
| Historical CSV Ingestion Pipeline & Alumni Stub Auto-Registration (`SAIS-STU-0309+`) | Done |
| Headteacher workspace (settings, subject grids, master sheet, contacts, health, audit & remediation) | Done |
| Teacher workspace (grid performance, zero-lag buffering, data loss protection, AI suite) | Done |
| Math Engine & Calculation Integrity (dynamic divisors, 2-decimal precision, ordinal ranks) | Done |
| Security & RBAC Fortification (context-level term locks, secondary Firebase Auth app for staff) | Done |
| Memory Management & PDF Engine (canvas GPU memory cleanup, JSZip batch export, payload compression) | Done |
| Firebase Auth / Firestore / Hosting Production Deployment | Done |
| Automated Delivery (WhatsApp + Email) | Done |
| Soft-delete, CSV import | In roadmap |

---

## System Architecture & Hardening Milestones

### 1. Teacher Workspace & Grid Performance
- **$O(1)$ Data Structures:** The Master Sheet grid utilizes $O(1)$ Hash Map lookups (`scoresMap`), completely removing $O(N \times M)$ linear array scans during table re-renders.
- **Zero-Lag Input Buffering:** Cells are isolated via `React.memo` and use local state buffering. Typing updates local state instantly, committing to the database on `onBlur` or component unmount.
- **Data-Loss Prevention:** Implemented `useRef` focus-tracking to prevent active typing from being overwritten by background context syncs, alongside unmount flush handlers that catch rapid keyboard and router navigation edge cases.

### 2. Math Engine & Calculation Integrity
- **Dynamic Divisors:** Student overall averages dynamically divide by the exact number of *recorded/assessed* subjects, protecting mid-year transfers and partial marksheets from zero-score penalties.
- **Global Precision & Ranking:** Enforced strict 2-decimal precision (`.toFixed(2)`) and deterministic competition ordinal ranking (e.g., `1st`, `2nd`, `2nd`, `4th`) across all analytics views and printable report sheets.

### 3. Security & RBAC Fortification
- **Context-Level Term Locks:** Security checks are strictly enforced inside the Context layer (`MarkGradingContext.tsx`). Client-side DOM manipulation of the `readOnly` attribute cannot bypass locked terms; mutations return explicit boolean status and trigger user alerts.
- **Safe Staff Account Creation:** Integrated a secondary Firebase App instance for the Headteacher "Add Teacher" workflow, allowing new staff Auth credentials to be provisioned without terminating the active Headteacher session.

### 4. Memory Management & PDF Engine
- **Memory-Safe Rendering:** The PDF generator explicitly clears HTML5 Canvas GPU memory (`width = 0; height = 0`) and unmounts React roots in a `finally` block, preventing memory leaks during bulk rendering.
- **JSZip Batch Export:** Batch report generation packages all rendered PDFs in memory using `JSZip` and downloads a single `.zip` file with browser yielding (`yieldToBrowser`), bypassing multi-download popup blockers.
- **Image Payload Optimization:** School branding logos and staff signatures are compressed client-side via HTML5 canvas prior to Firestore upload to prevent 1MB document size limits.

---

## Quick start

**Prerequisites:** Node.js 20+

```bash
cd report-system-website
npm install
cp .env.example .env.local   # fill keys as needed
```

Run **two** processes:

```bash
# Terminal A — API proxy (Gemini / WhatsApp / email) on :3001
npm run dev:api

# Terminal B — Vite UI on :3000
npm run dev
```

Open http://localhost:3000 → use Teacher / Headteacher portals.

```bash
npm run lint    # npx tsc --noEmit
npm run build   # production bundle
```

Vite proxies `/api/*` to the Express server (see `vite.config`).

---

## Environment

Copy from [`.env.example`](.env.example):

| Key | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | AI comment / chat flows |
| `GEMINI_MODEL` | Default `gemini-2.0-flash` |
| `PORT` | Express port (default `3001`) |
| `VITE_FAKE_LATENCY_MS` | Fake DB read latency for local repo (default `250`) |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Meta Graph API |
| `WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANGUAGE` | Approved template (default `student_report_pdf` / `en`) |
| `SMTP_*` | Optional Nodemailer email |

Without WhatsApp/SMTP credentials, delivery still runs; WhatsApp returns a soft “not configured” status; email may download PDFs as fallback.

---

## Project layout

```
report-system-website/
├── server.ts                 # Express: /api/gemini, /api/whatsapp, /api/email, /api/health
├── src/
│   ├── data/                 # DatabaseRepository + FirestoreRepository + LocalStorageRepository
│   ├── context/              # Auth, Database, Undo, AcademicYear, ClassStream, StudentRegistry
│   ├── contexts/             # MarkGradingContext (RBAC term lock enforcement)
│   ├── lib/                  # grading, programmeSchemas, transcript, academicYear, AI, pdf, scoreCalculations, reportMath
│   ├── components/           # reports (EOT / Midterm / Transcript) | mastersheet (Grid, Cell, Header)
│   └── pages/                # headteacher | teacher | student | auth | shared
├── public/sais-logo.png
└── docs/STATE_OF_DEVELOPMENT.md
```

### Data model (important)

- **Lifelong key:** `SAIS-{YearJoined}-{Sequence}` e.g. `SAIS-2023-0042` (immutable)
- **Roll number:** on `ClassEnrollment` only (class ops label)
- **termKey:** `YYYY_YYYY_T{n}` e.g. `2025_2026_T3`
- **enrolledTerms:** which terms count on the transcript (`T1`/`T2`/`T3`)
- **Finalize:** freezes `ReportSummary.subjectLines` — transcripts must not join live curriculum
- Storage keys are flat collections (e.g. `sais_lifelongStudents`, `sais_classEnrollments`) via [`src/data/`](src/data/)

IDs use `crypto.randomUUID()` (`createId()`).

---

## Roles & routes

| Role | Entry | Notable routes |
|------|-------|----------------|
| Headteacher | `/headteacher` | `/headteacher/transcripts`, `/headteacher/class-settings` |
| Teacher | `/teacher` | subjects, master, reports, delivery, AI, `/teacher/transcripts` |

Login is secured via **Firebase Google Sign-In** restricted to `@stadelaideschool.com`. Students and parents do NOT have logins; reports are sent directly via WhatsApp/Email.

---

## Brand theme

Portal chrome uses the official crest palette (Tailwind v4 `@theme` tokens in `src/index.css`):

| Token | Hex | Use |
|-------|-----|-----|
| `sais-red` | `#D82227` | Primary buttons, active nav, critical accents |
| `sais-brown` / `sais-bronze` | `#713F29` | Secondary buttons, borders, accents |
| `sais-black` / `sais-ink` | `#1E1A1B` | Sidebar, typography, high-contrast chrome |
| `sais-white` / `sais-cream` | `#FFFFFF` | App background, cards, report containers |

Logo: `public/sais-logo.png`. Display font: Libre Baskerville; UI: Source Sans 3.

---

## Production Deployment

Production is deployed and hosted on **Firebase Hosting**:
- **Hosting URL:** [https://heckteck-school.web.app](https://heckteck-school.web.app) / [https://sais-report-system.web.app](https://sais-report-system.web.app)
- **Build command:** `npm run build`
- **Deploy command:** `firebase deploy --only hosting`

---

Private — St. Adelaide International Schools / HecTech
