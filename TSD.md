# Technical Specification Document (TSD)

## Project: Voice-Activated Court Case Archive Inventory System

### 0. Repository Structure

Two separate git repositories:
- `court-archive-frontend` — Next.js app.
- `court-archive-backend` — NestJS API.

They communicate purely over HTTP; no shared code/package between them.

---

### 1. Architectural Design Overview

The system follows a standard Client-Server architecture: a Next.js web frontend connected to a NestJS backend service.

```
+--------------------+                 +--------------------------+
|  Frontend Client   | --(HTTP)---->   |     Backend Engine       |
|  (Next.js)         |                 | (NestJS)                 |
+--------------------+                 +--------------------------+
     |        ^                                     |
  [STT/TTS Platforms]                               v
  (Web Speech API)                          +-------------------+
                                           |     Database      |
                                           | (PostgreSQL + pg_trgm)|
                                           +-------------------+
```

---

### 2. Tech Stack Recommendations

#### Frontend: Next.js

- **Voice Transcription:** Web Speech API (`SpeechRecognition`) for zero-cost client-side Indonesian speech recognition.
- **Voice Generation:** Web Speech API (`SpeechSynthesis`) utilizing the `id-ID` locale.
- Fallback to a standard text input when `SpeechRecognition`/`speechSynthesis` are unsupported (see Section 7).
- **Styling:** Tailwind CSS for mobile-first responsive layout (see Section 7.1).
- **PWA:** installable web app manifest + minimal non-caching service worker (see Section 7.1) — no offline support in this version.

#### Backend & Database (Core Engine)

- **Runtime Environment:** Node.js with NestJS.
- **Database Management System:** PostgreSQL.
- **Password Hashing:** bcrypt for `users.password_hash`.
- **Search Optimization:** PostgreSQL Full-Text Search (FTS) bundled with extensions like `pg_trgm` (trigram matching) for robust Indonesian **Fuzzy Search** capabilities on free-text fields (`parties_involved`, `case_number_clean`). `case_type` is matched exactly against a fixed lookup list (see Section 4.3), not via fuzzy similarity — its vocabulary is small and known, so exact match avoids cross-matching unrelated case types.

---

### 3. Database Schema Design

A relational schema optimized to decouple case attributes from physical metadata inventory tracking.

```sql
-- 1. Table: Shelves (Physical Metadata Layout)
CREATE TABLE shelves (
    id SERIAL PRIMARY KEY,
    rack_name VARCHAR(50) NOT NULL,       -- e.g., 'Rak A', 'Rak B'
    row_number INT NOT NULL,              -- e.g., 1, 2, 3, 4
    slot_number INT,                      -- Optional finer granular breakdown
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Table: Cases (Arsip Sidang Perkara)
CREATE TABLE court_cases (
    id SERIAL PRIMARY KEY,
    case_number_raw VARCHAR(100) NOT NULL, -- Original formatted string e.g., '120/Pdt.G/2026/PN.Bks'
    case_number_clean VARCHAR(100),       -- Normalized string for fallback exact matching: '120 Pdt G 2026'
    case_type VARCHAR(50) NOT NULL,        -- e.g., 'Pdt.G', 'Pid.B'
    year INT NOT NULL,                     -- e.g., 2026
    parties_involved TEXT NOT NULL,       -- Full names of suspects, claimants, defendants
    shelf_id INT REFERENCES shelves(id),   -- Foreign key mapping to physical rack
    file_position_number VARCHAR(50),     -- Exact identifier inside row, e.g., 'No. 05'
    status VARCHAR(20) DEFAULT 'Available',-- 'Available' (Green UI), 'Borrowed' (Red UI)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Trigram index for robust Fuzzy Search across text parameters
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cases_fuzzy ON court_cases USING gin (parties_involved gin_trgm_ops);
CREATE INDEX idx_cases_number_clean ON court_cases USING gin (case_number_clean gin_trgm_ops);

-- 3. Table: Users (Auth & Role Control)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'petugas')),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 4. System Logic & Algorithmic Parsing

#### 4.1 Speech-to-Text (STT) Keyword Normalization Pipeline

When raw text is output by the STT engine, it must pass through an extraction filter before hitting the database:

1.  **Lowercasing & Stopword Removal:** Convert to lowercase; discard general noise words like "tolong", "cari", "arsip".
2.  **Number Conversion:** Convert Indonesian number words to integers via a hand-written rule-based mapper (no external library). Scope: 0–9,999, covering the vocabulary needed for case numbers and years.
    - Base tokens: `satu`..`sembilan` ➔ 1-9, `sepuluh` ➔ 10, `sebelas` ➔ 11, `X belas` ➔ 10+X, `X puluh` ➔ X*10 (combinable with a trailing unit, e.g. "dua puluh enam" ➔ 26), `seratus`/`X ratus` ➔ 100/X*100, `seribu`/`X ribu` ➔ 1000/X*1000.
    - Segments combine additively left-to-right (e.g., "dua ribu dua puluh enam" ➔ 2000 + 20 + 6 = `2026`).
    - Non-numeric connector words spoken for symbols (e.g., "garis miring" for `/`) are mapped to literal separators via a fixed lookup table, not parsed as numbers.
    - Unrecognized number tokens are dropped (not guessed), and the remaining clean array proceeds without them — a partial match is preferred over a wrong one.
3.  **Pattern Assembly:** Extract digits and case type acronyms into an clean array of searchable strings.

#### 4.2 Case Type Resolution (Exact Match)

`case_type` tokens (e.g., "pidana", "perdata", "pidana biasa") are matched against a fixed lookup table (e.g., `{ "pidana biasa": "Pid.B", "perdata gugatan": "Pdt.G" }`) rather than fuzzy `similarity()`. A token not found in the table is dropped from the query filter rather than fuzzy-guessed, since case type vocabulary is small, fixed, and a wrong guess here would misdirect the search into the wrong case category entirely.

#### 4.3 Database Query Implementation (Fuzzy Query)

```sql
-- Conceptual search for "Perkara Pidana 45 Ahmad"
SELECT
    c.case_number_raw, c.case_type, c.year, c.parties_involved, c.status,
    s.rack_name, s.row_number, c.file_position_number,
    similarity(c.case_number_clean, '45 pidana 2026') AS num_score,
    similarity(c.parties_involved, 'ahmad') AS party_score
FROM court_cases c
JOIN shelves s ON c.shelf_id = s.id
WHERE
    (c.case_number_clean % '45 pidana 2026' OR c.parties_involved % 'ahmad')
ORDER BY (num_score + party_score) DESC
LIMIT 5;
```

---

### 5. API Endpoints Specification

#### `POST /api/v1/archive/search`

- **Description:** Evaluates a raw text transcription string from the client frontend and outputs a rank-ordered list of matching cases.
- **Payload (JSON):**
  ```json
  {
    "raw_transcript": "cari perkara pidana nomor 45 tahun 2026 atas nama ahmad"
  }
  ```
- **Response (JSON):**
  ```json
  {
    "status": "success",
    "match_count": 1,
    "data": [
      {
        "id": 842,
        "case_number_raw": "45/Pid.B/2026/PN.Bks",
        "case_type": "Pid.B",
        "year": 2026,
        "parties_involved": "Ahmad Subarjo bin Slamet",
        "status": "Available",
        "location": {
          "rack": "Rak 4",
          "row": 2,
          "position": "05"
        },
        "tts_payload": "Arsip ditemukan. Perkara pidana biasa nomor empat puluh lima garis miring dua ribu dua puluh enam. Berada di Rak empat, Baris dua, nomor arsip kosong lima."
      }
    ]
  }
  ```

#### `POST /api/v1/auth/login`

- **Description:** Authenticates a user and returns a session token (JWT). Required before calling any other endpoint.
- **Payload:** `{ "username": "string", "password": "string" }`
- **Response:** `{ "token": "string", "role": "admin" | "petugas" }`
- **Access:** Public (unauthenticated).

#### `PATCH /api/v1/archive/cases/:id/status`

- **Description:** Toggles a case's availability status (Available ⇄ Borrowed).
- **Payload:** `{ "status": "Available" | "Borrowed" }`
- **Access:** Admin, Petugas.

#### `POST /api/v1/archive/cases` / `PUT /api/v1/archive/cases/:id` / `DELETE /api/v1/archive/cases/:id`

- **Description:** Standard CRUD for individual case records and shelf layout.
- **Access:** Admin only.

#### `POST /api/v1/archive/import`

- **Description:** Bulk-imports case records from an uploaded CSV/Excel file for initial data migration. Rows are validated (case number present, shelf reference resolvable); failing rows are collected and returned, not silently dropped — the rest of the batch still commits.
- **Access:** Admin only.
- **Response (JSON):**
  ```json
  {
    "status": "partial_success",
    "imported_count": 842,
    "rejected_rows": [
      { "row": 57, "reason": "Unresolvable shelf reference 'Rak Z'" },
      { "row": 103, "reason": "Missing case_number" }
    ]
  }
  ```

---

### 6. Auth & Authorization

- JWT-based session auth. Token returned by `/auth/login` is sent as `Authorization: Bearer <token>` on all subsequent requests.
- NestJS route guards enforce role checks: Admin-only routes (`cases` CRUD, `shelves` CRUD, `import`, user management) reject the `petugas` role with `403`.
- No anonymous access to any `/api/v1/*` route.

---

### 7. Frontend Browser Compatibility

- On mount, the frontend checks `window.SpeechRecognition || window.webkitSpeechRecognition`.
- If absent: hide the mic button, render a standard text `<input>` search box that posts the typed string to the same `/api/v1/archive/search` endpoint (the backend parsing pipeline treats typed and transcribed text identically).
- Independently, check `window.speechSynthesis` for TTS; if absent, render the response as text only (no audio playback), search functionality is unaffected either way.

---

### 7.1 Responsive Design & PWA (Installable, No Offline)

- **Responsive breakpoints:** mobile-first CSS with a single desktop breakpoint (e.g., Tailwind's default `md: 768px`). Below the breakpoint: single-column layout, full-width giant result text (PRD FR-4.1), bottom-anchored mic button for thumb reach. At/above the breakpoint: same content in a centered, max-width layout usable at a desk.
- **Web App Manifest:** `public/manifest.json` in the Next.js app —
  ```json
  {
    "name": "Arsip Perkara Suara",
    "short_name": "ArsipSuara",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0B1220",
    "theme_color": "#2C4A6E",
    "icons": [
      { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```
- **Linking the manifest:** referenced via `<link rel="manifest" href="/manifest.json">` and a `theme-color` meta tag in the Next.js root layout metadata (Next.js App Router's `metadata` export, not a manually-authored `<head>`).
- **Installability without offline:** a minimal service worker is registered solely to satisfy browser installability criteria (Chrome/Edge require an active service worker for the install prompt); its fetch handler passes every request straight to the network with no caching (`event.respondWith(fetch(event.request))`) — this is intentionally not a caching/offline strategy, per PRD Section 6.
- **No new heavy dependency:** achieved with a hand-written ~10-line service worker and Next.js's built-in metadata API — not `next-pwa` or Workbox, which are built for offline-first caching this version explicitly excludes.

---

### 8. Security: OWASP Top 10 (2021) Mapping

| # | Category | Mitigation in this system |
|---|----------|---------------------------|
| A01 | Broken Access Control | NestJS route guards enforce `admin` vs `petugas` on every endpoint (Section 6); ownership isn't per-record here, so checks are role-based, not object-based. `PATCH /cases/:id/status` explicitly excludes case-metadata fields, so a Petugas token can never smuggle a field edit into a status update. |
| A02 | Cryptographic Failures | Passwords hashed with bcrypt (never stored/logged in plaintext); JWT signed with a server-side secret from environment config, not committed to git; all traffic served over HTTPS in production (TLS termination at reverse proxy). |
| A03 | Injection | All DB access via TypeORM/Prisma parameterized queries — no raw string-concatenated SQL, including the fuzzy `similarity()` search (Section 4.3) and CSV import (Section 5), both of which take user-influenced input directly into query params, never interpolated. |
| A04 | Insecure Design | Numeric/case-type parsing (Section 4.1–4.2) fails closed: unrecognized tokens are dropped, not guessed — preventing a malformed voice transcript from producing an unintended broad query. Rejected import rows are reported, never silently coerced. |
| A05 | Security Misconfiguration | NestJS `ValidationPipe` with `whitelist: true` strips unexpected payload fields on every endpoint; verbose stack traces disabled outside development (`NODE_ENV=production`); default/example credentials never shipped in seed data. |
| A06 | Vulnerable & Outdated Components | `npm audit` (or equivalent) run in CI on both repos before merge to `develop`/`main`; dependency versions pinned in lockfiles. |
| A07 | Identification & Authentication Failures | JWT expiry enforced (short-lived access token); login endpoint rate-limited (e.g., `@nestjs/throttler`) to slow brute-force attempts against `username`/`password`. |
| A08 | Software & Data Integrity Failures | CSV/Excel import (Section 5) validates every row against a schema before insert — no `eval`/dynamic deserialization of uploaded file content. |
| A09 | Security Logging & Monitoring Failures | Failed login attempts and `403` authorization rejections logged server-side (NestJS interceptor) with timestamp, username, and route — not full request bodies, to avoid logging credentials. |
| A10 | Server-Side Request Forgery (SSRF) | Not applicable — the system makes no outbound requests to user-supplied URLs (STT/TTS run client-side via Web Speech API; no server-side fetch of external resources). Noted here for completeness rather than left unaddressed. |

---

### 9. Git Workflow (Gitflow)

Applied identically in both `court-archive-frontend` and `court-archive-backend` repos.

- **`main`** — production-ready code only. Every commit on `main` corresponds to a deployed release, tagged with a version (e.g., `v1.0.0`).
- **`develop`** — integration branch; latest completed work for the next release. All feature branches merge here first.
- **`feature/*`** — one branch per PRD requirement or logical unit of work (e.g., `feature/voice-search`, `feature/case-status-toggle`). Branches from `develop`, merges back to `develop` via PR.
- **`release/*`** — cut from `develop` when preparing a release (e.g., `release/1.0.0`); only bug fixes and release-prep changes (version bump, changelog) allowed here. Merges to both `main` and back to `develop` on completion.
- **`hotfix/*`** — branches from `main` for urgent production fixes; merges to both `main` and `develop`.
- Merges to `main` and `develop` happen via pull request, not direct push; PRs require the CI check (lint, test, `npm audit`) to pass before merge.
