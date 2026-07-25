# SAIS HecTech — Web Report System

React + Vite web port of the **St. Adelaide International Schools (SAIS)** HecTech AI report-card workflow (Primary + Secondary). Source of truth for grading behaviour was the Google Sheets vaults at `C:\googlesheets` (Primary) and `C:\googlesheets_secondary` (Secondary).

**Stack decision (locked):** Stay on **React + Vite**. Production path is **Firebase + Google** (Auth, Firestore, Hosting, Functions, Gemini) — not Next.js. Multi-campus is a data/auth concern, not a framework rewrite.

> Incoming developers: start with [`docs/STATE_OF_DEVELOPMENT.md`](docs/STATE_OF_DEVELOPMENT.md) for status, architecture, and what to build next.

---

## Features (current)

| Area | Status |
|------|--------|
| Primary / Secondary programme schemas (CW/MT/EOT, Music, Project Term 3, PE/Club) | Done |
| Active System Pointer (2026/2027 Term 1) & 13 Class Stream Provisioning | Done |
| Academic Year Archiving (2021–2026) with RBAC Read-Only Locks & HT Override | Done |
| Historical CSV Ingestion Pipeline & Alumni Stub Auto-Registration (`SAIS-STU-0309+`) | Done |
| Teacher workspace (settings, subject grids, master sheet, contacts, health) | Done |
| EOT + Midterm report cards + PDF batch (`html2canvas` + `jspdf`) | Done |
| Gemini AI (subject, general+traits, tools, chatbot) via Express proxy | Done |
| Email + WhatsApp delivery (Meta multipart upload + retries; ZIP class pack) | Done |
| Lifelong student keys + enrollments + year-safe term keys | Done |
| Student transcripts (search → key → print) for HT / teacher / student | Done |
| Async `DatabaseRepository` + localStorage adapter (Firestore-shaped) | Done |
| HT form/subject teacher reassignment + enrollment cascade | Done |
| Firebase Auth / Firestore (Staff Only RBAC) | Done |
| Automated Delivery (WhatsApp + Email) | Done |
| Soft-delete, CSV import | Not started |

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
npm run lint    # tsc --noEmit
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
│   ├── data/                 # DatabaseRepository + LocalStorageRepository (Firebase-ready)
│   ├── context/              # Auth, Database, Undo
│   ├── lib/                  # grading, programmeSchemas, transcript, academicYear, AI, pdf
│   ├── components/reports/   # EOT / Midterm / Transcript documents
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
| Headteacher | `/headteacher` | `/headteacher/transcripts` |
| Teacher | `/teacher` | subjects, master, reports, delivery, AI, `/teacher/transcripts` |

Login is secured via **Firebase Google Sign-In** restricted to `@stadelaideschool.com`. Students and parents do NOT have logins; reports are sent directly via WhatsApp/Email.

---

## Demo walkthrough

1. Login → **Load SAIS Demo Data**
2. Teacher → YEAR FIVE (A) or YEAR NINE (A)
3. Subject grids → Master Sheet → **Finalize Reports**
4. AI Subject / General comments (needs `GEMINI_API_KEY`)
5. Reports → PDF batch → Delivery (Email / WhatsApp)
6. Transcripts → search `BOATENG` → open `SAIS-2023-0042` → Print
7. Headteacher → Assign / reassign teachers (cascades enrollments)

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

Utilities: `bg-sais-red`, `text-sais-black`, `border-sais-brown`, etc.

---

## Roadmap (short)

1. Soft-delete + edit UX  
2. Class ZIP delivery pack + WhatsApp hardening (Meta media upload, template, webhooks)  
3. CSV import (`papaparse` already installed)  
4. Firebase Auth + Firestore adapter implementing `DatabaseRepository`  
5. Cloud Functions cutover from `server.ts` (requires Firebase Blaze for deploy; free-tier usage still fine for &lt;1k students)

Full briefing: [`docs/STATE_OF_DEVELOPMENT.md`](docs/STATE_OF_DEVELOPMENT.md).

---

Private — St. Adelaide International Schools / HecTech
