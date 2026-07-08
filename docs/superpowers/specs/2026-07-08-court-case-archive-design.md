# Design: Voice-Activated Court Case Archive Inventory System

**Date:** 2026-07-08
**Status:** Approved

## Summary

Hands-free inventory system for court case archives (arsip sidang perkara). Archivists speak a query (STT); the system parses it, searches PostgreSQL with fuzzy matching, and speaks back (TTS) the case's shelf/row/position — plus shows it in large, high-contrast text. Admins manage case/shelf data and bulk-import existing records; Petugas (clerks) search and toggle a case's Available/Borrowed status.

Full requirements and technical detail live in the project root:
- [`PRD.md`](../../../PRD.md) — product requirements, personas, functional/non-functional requirements, roles, migration, browser fallback.
- [`TSD.md`](../../../TSD.md) — architecture, DB schema, STT parsing algorithm, API spec, auth, OWASP Top 10 mapping, gitflow.

This document records the decisions made during brainstorming that shaped those two files, for anyone picking up the project later.

## Architecture

Two separate repositories, communicating over HTTP only:
- **`court-archive-frontend`** — Next.js. Web Speech API for STT (`SpeechRecognition`) and TTS (`speechSynthesis`), both `id-ID` locale. Falls back to a plain text search input when the browser lacks `SpeechRecognition`.
- **`court-archive-backend`** — NestJS + PostgreSQL. Owns parsing, search, auth, and CRUD.

No shared package between the two repos; the contract between them is the REST API defined in TSD.md Section 5.

## Key Decisions

- **Scope pivot:** started as a generic "document archive," reshaped to a court-case-specific domain per the user's existing PRD/TSD (case number, parties, court file status) rather than generic document metadata.
- **Search:** `pg_trgm` fuzzy `similarity()` on free-text fields (`parties_involved`, `case_number_clean`); `case_type` uses an exact lookup table instead of fuzzy matching — its vocabulary is small and fixed, so a wrong fuzzy guess would misdirect the search into the wrong case category.
- **Number parsing:** hand-written rule-based Indonesian number-word-to-integer mapper (no external library), scoped to 0–9,999. Unrecognized tokens are dropped rather than guessed — a partial match beats a wrong one.
- **Auth:** two roles, Admin (full CRUD on cases/shelves/users, CSV import) and Petugas (search + status toggle only). JWT-based, enforced via NestJS route guards. No anonymous access.
- **Initial data load:** Admin-only CSV/Excel import; failing rows are reported back as a rejected-rows list, not silently dropped or batch-aborted.
- **No digital file storage:** system tracks metadata and physical shelf location only — no PDF/scan upload, matching the original PRD scope.
- **Security:** OWASP Top 10 (2021) mapped concretely to this system's endpoints and flows (TSD.md Section 8) rather than a generic checklist.
- **Process:** classic Gitflow (`main`/`develop`/`feature`/`release`/`hotfix`) applied identically in both repos, PR-gated with CI (lint, test, `npm audit`).

## Testing

- Backend: unit tests for the number-word parser (base cases, combinations, unrecognized-token drop), case-type lookup resolution, and the fuzzy search query builder.
- Auth: unit/integration tests for role guards (Admin-only routes reject `petugas` with 403; no anonymous access).
- Import: tests covering partial-success behavior (some rows valid, some rejected) and the rejected-rows report shape.
- Frontend: manual test of STT/TTS in Chrome; manual test of the fallback text-input path with `SpeechRecognition` mocked as unavailable.

## Next Step

Proceed to `writing-plans` to break this into an implementation plan, using PRD.md and TSD.md as the authoritative spec.
