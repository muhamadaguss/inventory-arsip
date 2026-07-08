# Product Requirement Document (PRD)

## Project: Voice-Activated Court Case Archive Inventory System

### 1. Document Control

- **Version:** 1.0
- **Date:** July 8, 2026
- **Author:** Gemini AI
- **Status:** Draft

---

### 2. Executive Summary & Objective

Managing physical court case files (arsip sidang perkara) involves navigating thousands of sensitive, strictly formatted documents. For archivists and court clerks, manually searching for shelf locations via keyboard and mouse while holding heavy physical bundles is highly inefficient.

The objective of this application is to build a **hands-free, voice-activated inventory system** for court case archives. By utilizing **Speech-to-Text (STT)** for querying and **Text-to-Speech (TTS)** for delivering search results, the system enables users to locate files simply by speaking the case details. The system will explicitly fetch and read out the exact **Shelf (Rak)** and **Row/File Number (Nomor)** where the physical file is located. _Note: IoT hardware implementations (e.g., LED rack indicators) are deferred for future phases._

---

### 3. User Personas & Problem Statements

- **User Persona:** Court Archivist / Clerk (Petugas Arsip)
- **Environment:** Large physical archive rooms, warehouses, or record offices. Hands are often full holding case documents.
- **Key Problems:**
  1.  Inconvenience of typing complex case numbers while carrying document bundles.
  2.  Mistyping or forgetting the exact format of case symbols (e.g., `/Pdt.G/2026/PN.Bks`).
  3.  Squinting at small computer screens from across a row of shelves.

---

### 4. Functional Requirements

#### 4.1 Voice-Based Input (Speech-to-Text)

- **FR-1.1:** The system MUST provide a prominent, easy-to-tap Microphone Activation trigger button.
- **FR-1.2:** The STT engine MUST support continuous or single-phrase Indonesian voice processing.
- **FR-1.3:** The system MUST dynamically normalize spoken Indonesian phrases into standardized court case formats (e.g., "seratus dua puluh perdata gugat dua ribu dua puluh enam" translates into keywords `120 Pdt.G 2026`).

#### 4.2 Intelligent Core Search (Fuzzy & Full-Text Search)

- **FR-2.1:** The search system MUST use Fuzzy Matching to accommodate minor phonetic transcription errors from the STT engine (e.g., searching for "Budi" should surface "Budiman" or "Budiarto").
- **FR-2.2:** Search queries MUST match across critical database fields: Case Number, Case Type, Parties Involved (Terdakwa/Penggugat/Tergugat), and Year.

#### 4.3 Voice-Based Output (Text-to-Speech)

- **FR-3.1:** Upon finding a single match, the system MUST automatically generate and speak a structured, natural-sounding Indonesian phrase informing the user of the location.
  - _Standard format:_ "Arsip ditemukan. Perkara [Jenis] Nomor [Nomor] Tahun [Tahun]. Berada di Rak [Nama Rak], Baris [Nomor Baris], Nomor Arsip [Nomor]."
- **FR-3.2:** If multiple partial matches are found, the TTS MUST state the number of matches found and prompt the user for clarification instead of reading out all records continuously.
- **FR-3.3:** The UI MUST present a prominent "Mute/Stop Audio" button allowing immediate interruption of the TTS playback.

#### 4.4 User Interface & Visuals (Hands-Free Optimized)

- **FR-4.1 (Giant Text):** The result screen MUST display the target **RAK** and **NOMOR ARSIP** using highly readable, oversized typography readable from a 2-3 meter distance.
- **FR-4.2 (Status Indicators):** The system MUST display clear, high-contrast background color states indicating file availability:
  - _Green Fill:_ File is Available on the shelf.
  - _Red Fill:_ File is Checked Out / In Courtroom (Status Dipinjam).
- **FR-4.3:** Users with the Petugas Arsip role MUST be able to toggle a case's status (Available ⇄ Borrowed) directly from the result screen (see Section 7).

---

### 5. Non-Functional Requirements

- **NFR-1 (Language Support):** The system's STT and TTS engines must strictly operate with Indonesian locales (`id-ID`).
- **NFR-2 (Latency):** Voice transcription to initial database query response must take less than 1.5 seconds under typical network conditions.
- **NFR-3 (Accessibility):** High-contrast UI suitable for dimly lit physical record rooms or warehouses.

---

### 6. Out of Scope (Deferred Features)

- IoT integration (smart LED shelf guidance systems).
- Mobile Offline standalone STT/TTS models (Initial version assumes active web/local server connectivity)

---

### 7. User Roles & Access Control

- **Admin:** Full CRUD on case records (`court_cases`) and shelf/rack layout (`shelves`). Manages user accounts.
- **Petugas Arsip (Clerk):** Voice/text search only; can update a case's `status` field (Available ⇄ Borrowed) when checking a file in/out. Cannot edit case metadata or shelf layout.
- **FR-5.1:** The system MUST require login (username/password) for all users; no anonymous access.
- **FR-5.2:** The UI MUST hide Admin-only actions (case edit, shelf management, user management) from users with the Petugas role.

---

### 8. Initial Data Migration

- **FR-6.1:** The system MUST provide an Admin-only CSV/Excel import tool to bulk-load existing case records (case number, type, year, parties, shelf/row/position) during initial rollout.
- **FR-6.2:** Imported rows that fail validation (e.g., missing case number, unresolvable shelf reference) MUST be reported back to the Admin as a rejected-rows list rather than silently skipped or aborting the whole batch.
- **FR-6.3:** After initial migration, ongoing new cases are entered via the standard Admin form (single-record CRUD), not re-imported.

---

### 9. Browser Compatibility & Fallback

- **FR-7.1:** On page load, the system MUST detect whether the browser supports the `SpeechRecognition` API.
- **FR-7.2:** If unsupported (e.g., Firefox, Safari), the system MUST hide the microphone button and present a standard text search input as the sole search method, with no functional degradation to search results or TTS output (TTS via `speechSynthesis` has broader support and remains available where present; if absent, results display as text only).
