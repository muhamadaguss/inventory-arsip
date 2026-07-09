# Voice Search Backend (Plan 3 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/v1/archive/search` — accepts a raw STT transcript, normalizes it into searchable keywords (Indonesian number words → integers, case-type text → acronym), runs a `pg_trgm` fuzzy-similarity query against `court_cases`/`shelves`, and returns ranked results with a ready-to-speak Indonesian `tts_payload` per PRD FR-3.1–3.2 and TSD Section 4.

**Architecture:** A new `SearchModule` with a single controller/endpoint, backed by three focused, independently-testable services: `NumberWordsService` (bidirectional Indonesian number↔word conversion), `CaseTypeLookupService` (fixed lookup table), and `SearchService` (orchestrates normalization → fuzzy query via `PrismaService.$queryRaw` → result shaping, including `tts_payload` construction). This is the one place in the codebase using raw parameterized SQL, because `pg_trgm`'s `similarity()` function has no Prisma query-builder equivalent.

**Tech Stack:** NestJS 11 (existing), Prisma 7 `$queryRaw` tagged templates (existing PrismaService, new usage pattern), Jest (existing). No new npm dependencies.

## Global Constraints

- Locale for all `tts_payload` strings is Indonesian (`id-ID`) — no English words anywhere in generated speech text (PRD NFR-1).
- No anonymous access to any `/api/v1/*` route — this endpoint requires a valid JWT (TSD Section 6).
- `POST /api/v1/archive/search` is accessible to both `admin` and `petugas` roles (same read-access pattern as `GET /archive/cases`).
- All DB access via Prisma is parameterized — **exception, explicitly scoped to this plan**: `SearchService` uses `PrismaService.$queryRaw` **tagged template literals only** (never `$queryRawUnsafe`, never string concatenation) to invoke `pg_trgm`'s `similarity()`, which has no Prisma query-builder equivalent (TSD Section 4.3, Section 8 A03). This is the sole authorized use of raw SQL in the codebase.
- Number word parsing scope: 0–9,999, additive left-to-right combination (TSD Section 4.1) — unrecognized tokens are dropped, not guessed; a partial match is preferred over a wrong one.
- `case_type` resolution is exact-match against a fixed lookup table, never fuzzy — a wrong guess here would misdirect the search into the wrong case category (TSD Section 4.2).
- Repository is the monorepo `court-archive-backend/` subfolder inside `inventory-arsip` — every commit in this plan is scoped to paths under `court-archive-backend/`.
- Reuses `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`) and `RolesGuard` + `@Roles(...)` (`src/auth/guards/roles.guard.ts`, `src/common/decorators/roles.decorator.ts`) from Plan 1 — do not reimplement guard logic.
- Multi-match behavior (PRD FR-3.2): 0 results → `tts_payload` states nothing was found; exactly 1 result → `tts_payload` states the full location (case type, number, year, rack, row, position); 2+ results → `tts_payload` states the match count and asks for more specific details, without reading out any location. The HTTP response always returns up to 5 ranked results regardless of this branching, so the frontend can render a selection list.
- Git workflow: this plan branches from `develop` (gitflow, TSD Section 9) — not `main`. Every task's commits land on a feature branch cut from `develop`; the plan does not merge to `main` directly.

---

## File Structure

```
court-archive-backend/
├── src/
│   ├── search/
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── search.controller.spec.ts
│   │   ├── search.service.ts
│   │   ├── search.service.spec.ts
│   │   ├── number-words.service.ts
│   │   ├── number-words.service.spec.ts
│   │   ├── case-type-lookup.service.ts
│   │   ├── case-type-lookup.service.spec.ts
│   │   └── dto/
│   │       └── search.dto.ts
├── test/
│   └── search.e2e-spec.ts
```

Each file's responsibility:
- `number-words.service.ts` — pure functions, no DB/HTTP: Indonesian number word tokens → integer (`parse`), and integer → Indonesian number words (`toWords`), used both for parsing the STT transcript and for building the spoken `tts_payload`.
- `case-type-lookup.service.ts` — pure lookup, no DB/HTTP: Indonesian case-type phrases → the acronym stored in `court_cases.case_type` (e.g., `"pidana biasa"` → `"Pid.B"`).
- `search.service.ts` — orchestration: takes the raw transcript, extracts keywords (calling the two services above), builds and runs the `$queryRaw` fuzzy query, shapes the response including `tts_payload`. This is the only file touching Prisma or building spoken sentences.
- `search.controller.ts` — HTTP layer only: guard/role wiring, DTO validation, delegates to `SearchService`.

---

### Task 1: NumberWordsService — Indonesian number words to integer

**Files:**
- Create: `src/search/number-words.service.ts`
- Create: `src/search/number-words.service.spec.ts`

**Interfaces:**
- Produces: `NumberWordsService.parse(tokens: string[]): { value: number | null; consumedTokens: number }` — given a lowercased token array starting at some position, greedily consumes as many number-word tokens as it can combine into one integer, returns the parsed value and how many tokens were consumed (`0` consumed means the first token wasn't a number word at all). Consumed by `SearchService` (Task 4) to extract numbers (case number, year) from a transcript's token stream. `toWords` (the reverse direction) is added in Task 2 on the same service/file.

- [ ] **Step 1: Write the failing tests**

Create `src/search/number-words.service.spec.ts`:

```typescript
import { NumberWordsService } from './number-words.service';

describe('NumberWordsService.parse', () => {
  let service: NumberWordsService;

  beforeEach(() => {
    service = new NumberWordsService();
  });

  it('parses a single-digit number word', () => {
    const result = service.parse(['lima']);
    expect(result).toEqual({ value: 5, consumedTokens: 1 });
  });

  it('parses "sepuluh" as 10', () => {
    const result = service.parse(['sepuluh']);
    expect(result).toEqual({ value: 10, consumedTokens: 1 });
  });

  it('parses "X belas" as 10+X', () => {
    const result = service.parse(['tiga', 'belas']);
    expect(result).toEqual({ value: 13, consumedTokens: 2 });
  });

  it('parses "X puluh Y" as X*10+Y', () => {
    const result = service.parse(['empat', 'puluh', 'lima']);
    expect(result).toEqual({ value: 45, consumedTokens: 3 });
  });

  it('parses "seratus" as 100', () => {
    const result = service.parse(['seratus']);
    expect(result).toEqual({ value: 100, consumedTokens: 1 });
  });

  it('parses "dua ribu dua puluh enam" as 2026 (additive combination)', () => {
    const result = service.parse(['dua', 'ribu', 'dua', 'puluh', 'enam']);
    expect(result).toEqual({ value: 2026, consumedTokens: 5 });
  });

  it('stops consuming at a non-number token', () => {
    const result = service.parse(['empat', 'puluh', 'lima', 'pidana']);
    expect(result).toEqual({ value: 45, consumedTokens: 3 });
  });

  it('returns null value and 0 consumed for a non-number first token', () => {
    const result = service.parse(['pidana']);
    expect(result).toEqual({ value: null, consumedTokens: 0 });
  });

  it('returns null value and 0 consumed for an empty token array', () => {
    const result = service.parse([]);
    expect(result).toEqual({ value: null, consumedTokens: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/search/number-words.service.spec.ts`
Expected: FAIL — `Cannot find module './number-words.service'`

- [ ] **Step 3: Write NumberWordsService (parse direction)**

Create `src/search/number-words.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';

const UNITS: Record<string, number> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
};

const TEENS: Record<string, number> = {
  sepuluh: 10,
  sebelas: 11,
};

export interface ParseResult {
  value: number | null;
  consumedTokens: number;
}

@Injectable()
export class NumberWordsService {
  parse(tokens: string[]): ParseResult {
    if (tokens.length === 0) {
      return { value: null, consumedTokens: 0 };
    }

    let total = 0;
    let index = 0;
    let matchedAny = false;

    while (index < tokens.length) {
      const segment = this.parseSegment(tokens, index);
      if (segment === null) {
        break;
      }
      total += segment.value;
      index += segment.consumed;
      matchedAny = true;
    }

    if (!matchedAny) {
      return { value: null, consumedTokens: 0 };
    }

    return { value: total, consumedTokens: index };
  }

  private parseSegment(tokens: string[], start: number): { value: number; consumed: number } | null {
    const token = tokens[start];

    if (token === 'seribu') {
      return { value: 1000, consumed: 1 };
    }
    if (token === 'seratus') {
      return { value: 100, consumed: 1 };
    }
    if (TEENS[token] !== undefined) {
      return { value: TEENS[token], consumed: 1 };
    }

    if (UNITS[token] !== undefined) {
      const unitValue = UNITS[token];
      const next = tokens[start + 1];

      if (next === 'ribu') {
        return { value: unitValue * 1000, consumed: 2 };
      }
      if (next === 'ratus') {
        return { value: unitValue * 100, consumed: 2 };
      }
      if (next === 'belas') {
        return { value: 10 + unitValue, consumed: 2 };
      }
      if (next === 'puluh') {
        const afterPuluh = tokens[start + 2];
        if (afterPuluh !== undefined && UNITS[afterPuluh] !== undefined) {
          return { value: unitValue * 10 + UNITS[afterPuluh], consumed: 3 };
        }
        return { value: unitValue * 10, consumed: 2 };
      }

      return { value: unitValue, consumed: 1 };
    }

    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/search/number-words.service.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/search/number-words.service.ts court-archive-backend/src/search/number-words.service.spec.ts
git commit -m "feat: add Indonesian number-words-to-integer parser"
```

---

### Task 2: NumberWordsService — integer to Indonesian number words (reverse)

**Files:**
- Modify: `src/search/number-words.service.ts`
- Modify: `src/search/number-words.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `NumberWordsService.toWords(n: number): string` — converts a non-negative integer (0–9,999, matching the parse direction's scope) into its Indonesian words, space-separated, no capitalization. Consumed by `SearchService` (Task 6) to build the spoken `tts_payload` (e.g., case number, year, rack row/position numbers all get spoken as words, per the brainstormed design decision).

- [ ] **Step 1: Write the failing tests**

Add to `src/search/number-words.service.spec.ts`, after the existing `describe('NumberWordsService.parse', ...)` block:

```typescript
describe('NumberWordsService.toWords', () => {
  let service: NumberWordsService;

  beforeEach(() => {
    service = new NumberWordsService();
  });

  it('converts single digits', () => {
    expect(service.toWords(5)).toBe('lima');
  });

  it('converts 10 as "sepuluh"', () => {
    expect(service.toWords(10)).toBe('sepuluh');
  });

  it('converts 11 as "sebelas"', () => {
    expect(service.toWords(11)).toBe('sebelas');
  });

  it('converts teens as "X belas"', () => {
    expect(service.toWords(13)).toBe('tiga belas');
  });

  it('converts round tens as "X puluh"', () => {
    expect(service.toWords(40)).toBe('empat puluh');
  });

  it('converts tens with a unit as "X puluh Y"', () => {
    expect(service.toWords(45)).toBe('empat puluh lima');
  });

  it('converts exactly 100 as "seratus"', () => {
    expect(service.toWords(100)).toBe('seratus');
  });

  it('converts hundreds with remainder', () => {
    expect(service.toWords(120)).toBe('seratus dua puluh');
  });

  it('converts 2026 as "dua ribu dua puluh enam"', () => {
    expect(service.toWords(2026)).toBe('dua ribu dua puluh enam');
  });

  it('converts 0 as "kosong"', () => {
    expect(service.toWords(0)).toBe('kosong');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/search/number-words.service.spec.ts`
Expected: FAIL — `service.toWords is not a function`

- [ ] **Step 3: Add toWords to NumberWordsService**

Edit `src/search/number-words.service.ts`, add these constants near the top (after `TEENS`) and the method inside the class, after `parse`:

```typescript
const UNIT_WORDS = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
```

```typescript
  toWords(n: number): string {
    if (n === 0) {
      return 'kosong';
    }

    const parts: string[] = [];
    let remaining = n;

    if (remaining >= 1000) {
      const thousands = Math.floor(remaining / 1000);
      parts.push(thousands === 1 ? 'seribu' : `${UNIT_WORDS[thousands]} ribu`);
      remaining %= 1000;
    }

    if (remaining >= 100) {
      const hundreds = Math.floor(remaining / 100);
      parts.push(hundreds === 1 ? 'seratus' : `${UNIT_WORDS[hundreds]} ratus`);
      remaining %= 100;
    }

    if (remaining === 11) {
      parts.push('sebelas');
      remaining = 0;
    } else if (remaining >= 10 && remaining < 20) {
      parts.push(`${UNIT_WORDS[remaining - 10]} belas`);
      remaining = 0;
    } else if (remaining === 10) {
      parts.push('sepuluh');
      remaining = 0;
    } else if (remaining >= 20) {
      const tens = Math.floor(remaining / 10);
      parts.push(`${UNIT_WORDS[tens]} puluh`);
      remaining %= 10;
      if (remaining > 0) {
        parts.push(UNIT_WORDS[remaining]);
      }
    } else if (remaining > 0) {
      parts.push(UNIT_WORDS[remaining]);
    }

    return parts.join(' ');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/search/number-words.service.spec.ts`
Expected: PASS (19 tests total: 9 from Task 1 + 10 from this task)

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/search/number-words.service.ts court-archive-backend/src/search/number-words.service.spec.ts
git commit -m "feat: add integer-to-Indonesian-number-words conversion"
```

---

### Task 3: CaseTypeLookupService — exact-match case type resolution

**Files:**
- Create: `src/search/case-type-lookup.service.ts`
- Create: `src/search/case-type-lookup.service.spec.ts`

**Interfaces:**
- Produces: `CaseTypeLookupService.resolve(phrase: string): string | null` — given a lowercased phrase (e.g., `"pidana biasa"`), returns the matching acronym (e.g., `"Pid.B"`) or `null` if not found (TSD Section 4.2: unmatched tokens are dropped, not guessed). Consumed by `SearchService` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `src/search/case-type-lookup.service.spec.ts`:

```typescript
import { CaseTypeLookupService } from './case-type-lookup.service';

describe('CaseTypeLookupService', () => {
  let service: CaseTypeLookupService;

  beforeEach(() => {
    service = new CaseTypeLookupService();
  });

  it('resolves "pidana biasa" to "Pid.B"', () => {
    expect(service.resolve('pidana biasa')).toBe('Pid.B');
  });

  it('resolves "perdata gugatan" to "Pdt.G"', () => {
    expect(service.resolve('perdata gugatan')).toBe('Pdt.G');
  });

  it('returns null for an unrecognized phrase', () => {
    expect(service.resolve('perkara antariksa')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(service.resolve('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/search/case-type-lookup.service.spec.ts`
Expected: FAIL — `Cannot find module './case-type-lookup.service'`

- [ ] **Step 3: Write CaseTypeLookupService**

Create `src/search/case-type-lookup.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';

const CASE_TYPE_LOOKUP: Record<string, string> = {
  'pidana biasa': 'Pid.B',
  pidana: 'Pid.B',
  'perdata gugatan': 'Pdt.G',
  perdata: 'Pdt.G',
};

@Injectable()
export class CaseTypeLookupService {
  resolve(phrase: string): string | null {
    const trimmed = phrase.trim();
    if (!trimmed) {
      return null;
    }
    return CASE_TYPE_LOOKUP[trimmed] ?? null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/search/case-type-lookup.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/search/case-type-lookup.service.ts court-archive-backend/src/search/case-type-lookup.service.spec.ts
git commit -m "feat: add exact-match case type lookup table"
```

---

### Task 4: SearchService — transcript normalization into query keywords

**Files:**
- Create: `src/search/search.service.ts`
- Create: `src/search/search.service.spec.ts`

**Interfaces:**
- Consumes: `NumberWordsService.parse` (Task 1), `CaseTypeLookupService.resolve` (Task 3).
- Produces: `SearchService.extractKeywords(transcript: string): { year: number | null; caseType: string | null; caseNumber: number | null; nameTokens: string[] }` — a private-feeling but unit-tested method that tokenizes the lowercased transcript, strips stopwords (`tolong`, `cari`, `arsip`, `nomor`, `perkara`, `atas`, `nama`), then walks the remaining tokens left-to-right: at each position, try `CaseTypeLookupService.resolve` against 1-2 token windows first (case type phrases are checked before numbers, since "pidana" alone must not be mistaken for anything numeric), then try `NumberWordsService.parse`; anything consumed by either becomes `caseType`/one of the two numeric slots (the first number found becomes `caseNumber`, unless it looks like a 4-digit year in the 1900–2100 range and no case number has a stronger match yet — see Step 3's disambiguation logic); everything else becomes a name token candidate for `parties_involved` fuzzy matching. This method and its fuzzy-query counterpart (Task 5) are added to the SAME service/file — this task builds and tests normalization in isolation first.

- [ ] **Step 1: Write the failing tests**

Create `src/search/search.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { SearchService } from './search.service';
import { NumberWordsService } from './number-words.service';
import { CaseTypeLookupService } from './case-type-lookup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SearchService.extractKeywords', () => {
  let service: SearchService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        NumberWordsService,
        CaseTypeLookupService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('extracts case type, case number, and year from a full transcript', () => {
    const result = service.extractKeywords(
      'cari perkara pidana biasa nomor empat puluh lima tahun dua ribu dua puluh enam atas nama ahmad',
    );

    expect(result.caseType).toBe('Pid.B');
    expect(result.caseNumber).toBe(45);
    expect(result.year).toBe(2026);
    expect(result.nameTokens).toEqual(['ahmad']);
  });

  it('extracts only a name when no case type or numbers are present', () => {
    const result = service.extractKeywords('cari budi santoso');

    expect(result.caseType).toBeNull();
    expect(result.caseNumber).toBeNull();
    expect(result.year).toBeNull();
    expect(result.nameTokens).toEqual(['budi', 'santoso']);
  });

  it('drops unrecognized case type tokens rather than guessing', () => {
    const result = service.extractKeywords('cari perkara antariksa nomor lima');

    expect(result.caseType).toBeNull();
    expect(result.caseNumber).toBe(5);
  });

  it('treats a lone 4-digit-range number as year when it is the only number found', () => {
    const result = service.extractKeywords('cari perkara tahun dua ribu dua puluh enam');

    expect(result.year).toBe(2026);
    expect(result.caseNumber).toBeNull();
  });

  it('returns all-null/empty for an empty transcript', () => {
    const result = service.extractKeywords('');

    expect(result).toEqual({ year: null, caseType: null, caseNumber: null, nameTokens: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/search/search.service.spec.ts`
Expected: FAIL — `Cannot find module './search.service'`

- [ ] **Step 3: Write SearchService.extractKeywords**

Create `src/search/search.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberWordsService } from './number-words.service';
import { CaseTypeLookupService } from './case-type-lookup.service';

const STOPWORDS = new Set(['tolong', 'cari', 'arsip', 'nomor', 'perkara', 'atas', 'nama', 'tahun']);

export interface ExtractedKeywords {
  year: number | null;
  caseType: string | null;
  caseNumber: number | null;
  nameTokens: string[];
}

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private numberWords: NumberWordsService,
    private caseTypeLookup: CaseTypeLookupService,
  ) {}

  extractKeywords(transcript: string): ExtractedKeywords {
    const tokens = transcript
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0 && !STOPWORDS.has(token));

    let caseType: string | null = null;
    const foundNumbers: number[] = [];
    const nameTokens: string[] = [];

    let index = 0;
    while (index < tokens.length) {
      const twoWordPhrase = tokens.slice(index, index + 2).join(' ');
      const twoWordMatch = this.caseTypeLookup.resolve(twoWordPhrase);
      if (twoWordMatch && caseType === null) {
        caseType = twoWordMatch;
        index += 2;
        continue;
      }

      const oneWordMatch = this.caseTypeLookup.resolve(tokens[index]);
      if (oneWordMatch && caseType === null) {
        caseType = oneWordMatch;
        index += 1;
        continue;
      }

      const numberResult = this.numberWords.parse(tokens.slice(index));
      if (numberResult.value !== null) {
        foundNumbers.push(numberResult.value);
        index += numberResult.consumedTokens;
        continue;
      }

      nameTokens.push(tokens[index]);
      index += 1;
    }

    const { year, caseNumber } = this.disambiguateNumbers(foundNumbers);

    return { year, caseType, caseNumber, nameTokens };
  }

  private disambiguateNumbers(numbers: number[]): { year: number | null; caseNumber: number | null } {
    if (numbers.length === 0) {
      return { year: null, caseNumber: null };
    }

    const yearCandidates = numbers.filter((n) => n >= 1900 && n <= 2100);
    const nonYearCandidates = numbers.filter((n) => n < 1900 || n > 2100);

    if (numbers.length === 1) {
      const only = numbers[0];
      const isYear = only >= 1900 && only <= 2100;
      return { year: isYear ? only : null, caseNumber: isYear ? null : only };
    }

    return {
      year: yearCandidates[0] ?? null,
      caseNumber: nonYearCandidates[0] ?? null,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/search/search.service.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/search/search.service.ts court-archive-backend/src/search/search.service.spec.ts
git commit -m "feat: add transcript keyword extraction to SearchService"
```

---

### Task 5: SearchService — fuzzy query execution via $queryRaw

**Files:**
- Modify: `src/search/search.service.ts`
- Modify: `src/search/search.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService.$queryRaw` (Plan 1), `extractKeywords` (Task 4).
- Produces: `SearchService.findMatches(keywords: ExtractedKeywords): Promise<CaseMatch[]>` where `CaseMatch = { id: number; caseNumberRaw: string; caseType: string; year: number; partiesInvolved: string; status: 'Available' | 'Borrowed'; rackName: string | null; rowNumber: number | null; filePositionNumber: string | null }` — runs the `pg_trgm` similarity query (TSD Section 4.3), ranked descending, limited to 5 rows. Consumed by `SearchController` (Task 7) and by `buildTtsPayload` (Task 6, same file).

- [ ] **Step 1: Write the failing tests**

Add to `src/search/search.service.spec.ts`, as a new top-level `describe` block after the existing one:

```typescript
describe('SearchService.findMatches', () => {
  let service: SearchService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        NumberWordsService,
        CaseTypeLookupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('queries with the party name and returns mapped rows', async () => {
    const dbRow = {
      id: 1,
      caseNumberRaw: '45/Pid.B/2026/PN.Bks',
      caseType: 'Pid.B',
      year: 2026,
      partiesInvolved: 'Ahmad Subarjo',
      status: 'Available',
      rackName: 'Rak 4',
      rowNumber: 2,
      filePositionNumber: '05',
    };
    prisma.$queryRaw.mockResolvedValue([dbRow]);

    const result = await service.findMatches({
      year: 2026,
      caseType: 'Pid.B',
      caseNumber: 45,
      nameTokens: ['ahmad'],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([dbRow]);
  });

  it('returns an empty array when no keywords were extracted at all', async () => {
    const result = await service.findMatches({ year: null, caseType: null, caseNumber: null, nameTokens: [] });

    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns an empty array when the query finds no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await service.findMatches({ year: null, caseType: null, caseNumber: null, nameTokens: ['zzzznotfound'] });

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/search/search.service.spec.ts`
Expected: FAIL — `service.findMatches is not a function`

- [ ] **Step 3: Add findMatches to SearchService**

Edit `src/search/search.service.ts` — add the import and the method inside the class, after `extractKeywords`/`disambiguateNumbers`:

```typescript
import { Prisma } from '@prisma/client';
```

```typescript
export interface CaseMatch {
  id: number;
  caseNumberRaw: string;
  caseType: string;
  year: number;
  partiesInvolved: string;
  status: 'Available' | 'Borrowed';
  rackName: string | null;
  rowNumber: number | null;
  filePositionNumber: string | null;
}
```

```typescript
  async findMatches(keywords: ExtractedKeywords): Promise<CaseMatch[]> {
    const nameQuery = keywords.nameTokens.join(' ');
    const hasAnyKeyword = keywords.year !== null || keywords.caseType !== null || keywords.caseNumber !== null || nameQuery.length > 0;

    if (!hasAnyKeyword) {
      return [];
    }

    const numberQuery = keywords.caseNumber !== null ? String(keywords.caseNumber) : '';

    const rows = await this.prisma.$queryRaw<CaseMatch[]>`
      SELECT
        c.id, c.case_number_raw AS "caseNumberRaw", c.case_type AS "caseType",
        c.year, c.parties_involved AS "partiesInvolved", c.status,
        s.rack_name AS "rackName", s.row_number AS "rowNumber", c.file_position_number AS "filePositionNumber"
      FROM court_cases c
      LEFT JOIN shelves s ON c.shelf_id = s.id
      WHERE
        (${keywords.caseType}::text IS NULL OR c.case_type = ${keywords.caseType})
        AND (${keywords.year}::int IS NULL OR c.year = ${keywords.year})
        AND (
          ${numberQuery} = '' OR similarity(c.case_number_clean, ${numberQuery}) > 0.3
        )
        AND (
          ${nameQuery} = '' OR similarity(c.parties_involved, ${nameQuery}) > 0.3
        )
      ORDER BY
        (
          CASE WHEN ${numberQuery} = '' THEN 0 ELSE similarity(c.case_number_clean, ${numberQuery}) END
          + CASE WHEN ${nameQuery} = '' THEN 0 ELSE similarity(c.parties_involved, ${nameQuery}) END
        ) DESC
      LIMIT 5
    `;

    return rows;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/search/search.service.spec.ts`
Expected: PASS (8 tests total: 5 from Task 4 + 3 from this task)

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/search/search.service.ts court-archive-backend/src/search/search.service.spec.ts
git commit -m "feat: add pg_trgm fuzzy match query to SearchService"
```

---

### Task 6: SearchService — tts_payload builder

**Files:**
- Modify: `src/search/search.service.ts`
- Modify: `src/search/search.service.spec.ts`

**Interfaces:**
- Consumes: `NumberWordsService.toWords` (Task 2), `CaseMatch[]` (Task 5).
- Produces: `SearchService.buildTtsPayload(matches: CaseMatch[]): string` — implements the PRD FR-3.1/FR-3.2 branching (0/1/2+ results) using `toWords` to speak every number in the sentence, per TSD Section 5's example format. Consumed by `SearchController` (Task 7).

- [ ] **Step 1: Write the failing tests**

Add to `src/search/search.service.spec.ts`, as a new top-level `describe` block:

```typescript
describe('SearchService.buildTtsPayload', () => {
  let service: SearchService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        NumberWordsService,
        CaseTypeLookupService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  const singleMatch = {
    id: 1,
    caseNumberRaw: '45/Pid.B/2026/PN.Bks',
    caseType: 'Pid.B',
    year: 2026,
    partiesInvolved: 'Ahmad Subarjo',
    status: 'Available' as const,
    rackName: 'Rak 4',
    rowNumber: 2,
    filePositionNumber: '05',
  };

  it('states not found when there are zero matches', () => {
    const payload = service.buildTtsPayload([]);
    expect(payload).toBe('Arsip tidak ditemukan.');
  });

  it('states the full location when there is exactly one match', () => {
    const payload = service.buildTtsPayload([singleMatch]);
    expect(payload).toBe(
      'Arsip ditemukan. Perkara Pid.B nomor empat puluh lima tahun dua ribu dua puluh enam. Berada di Rak 4, Baris dua, nomor arsip kosong lima.',
    );
  });

  it('states the count and asks for more detail when there are multiple matches', () => {
    const payload = service.buildTtsPayload([singleMatch, { ...singleMatch, id: 2 }]);
    expect(payload).toBe('Ditemukan dua arsip. Mohon sebutkan detail yang lebih spesifik.');
  });

  it('handles a match with no shelf assigned', () => {
    const payload = service.buildTtsPayload([{ ...singleMatch, rackName: null, rowNumber: null, filePositionNumber: null }]);
    expect(payload).toBe(
      'Arsip ditemukan. Perkara Pid.B nomor empat puluh lima tahun dua ribu dua puluh enam. Lokasi rak belum ditentukan.',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/search/search.service.spec.ts`
Expected: FAIL — `service.buildTtsPayload is not a function`

- [ ] **Step 3: Add buildTtsPayload to SearchService**

Edit `src/search/search.service.ts` — add the import and the method inside the class, after `findMatches`:

Update the constructor's imports are already present (`NumberWordsService` already injected from Task 4). Add this method:

```typescript
  buildTtsPayload(matches: CaseMatch[]): string {
    if (matches.length === 0) {
      return 'Arsip tidak ditemukan.';
    }

    if (matches.length > 1) {
      const countWord = this.numberWords.toWords(matches.length);
      return `Ditemukan ${countWord} arsip. Mohon sebutkan detail yang lebih spesifik.`;
    }

    const match = matches[0];
    const caseNumberDigits = match.caseNumberRaw.split('/')[0];
    const caseNumberWords = /^\d+$/.test(caseNumberDigits)
      ? this.numberWords.toWords(Number(caseNumberDigits))
      : caseNumberDigits;
    const yearWords = this.numberWords.toWords(match.year);

    const summary = `Arsip ditemukan. Perkara ${match.caseType} nomor ${caseNumberWords} tahun ${yearWords}.`;

    if (match.rackName === null || match.rowNumber === null) {
      return `${summary} Lokasi rak belum ditentukan.`;
    }

    const rowWords = this.numberWords.toWords(match.rowNumber);
    const positionWords = this.filePositionToWords(match.filePositionNumber);

    return `${summary} Berada di ${match.rackName}, Baris ${rowWords}, nomor arsip ${positionWords}.`;
  }

  private filePositionToWords(filePosition: string | null): string {
    if (filePosition === null) {
      return 'tidak diketahui';
    }
    const digits = filePosition.replace(/\D/g, '');
    if (!digits) {
      return filePosition;
    }
    return digits
      .split('')
      .map((digit) => this.numberWords.toWords(Number(digit)))
      .join(' ');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/search/search.service.spec.ts`
Expected: PASS (12 tests total: 8 from Task 5 + 4 from this task)

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/search/search.service.ts court-archive-backend/src/search/search.service.spec.ts
git commit -m "feat: add tts_payload builder with 0/1/multi-match branching"
```

---

### Task 7: SearchController — endpoint wiring, module, and e2e proof

**Files:**
- Create: `src/search/dto/search.dto.ts`
- Create: `src/search/search.controller.ts`
- Create: `src/search/search.controller.spec.ts`
- Create: `src/search/search.module.ts`
- Modify: `src/app.module.ts`
- Create: `test/search.e2e-spec.ts`

**Interfaces:**
- Consumes: `SearchService.extractKeywords`, `.findMatches`, `.buildTtsPayload` (Tasks 4-6), `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` (Plan 1).
- Produces: `POST /api/v1/archive/search` (`@Roles('admin', 'petugas')`), request body `{ raw_transcript: string }` (TSD Section 5), response `{ status: 'success', match_count: number, data: Array<{ id, case_number_raw, case_type, year, parties_involved, status, location: { rack, row, position } | null, tts_payload }> }` — the per-result `tts_payload` in each array element is the SAME sentence structure `buildTtsPayload` produces for a single match (so the frontend can play any individual result's location back), while the top-level response also carries the branching payload for the initial multi/zero-match announcement, added as a top-level `tts_payload` field.

- [ ] **Step 1: Write the search DTO**

Create `src/search/dto/search.dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchDto {
  @IsString()
  @IsNotEmpty()
  raw_transcript: string;
}
```

- [ ] **Step 2: Write the failing controller test**

Create `src/search/search.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: {
    extractKeywords: jest.Mock;
    findMatches: jest.Mock;
    buildTtsPayload: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      extractKeywords: jest.fn(),
      findMatches: jest.fn(),
      buildTtsPayload: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: service }],
    }).compile();

    controller = moduleRef.get(SearchController);
  });

  it('returns a shaped response with match_count and per-result tts_payload', async () => {
    const keywords = { year: 2026, caseType: 'Pid.B', caseNumber: 45, nameTokens: ['ahmad'] };
    const matches = [
      {
        id: 1,
        caseNumberRaw: '45/Pid.B/2026/PN.Bks',
        caseType: 'Pid.B',
        year: 2026,
        partiesInvolved: 'Ahmad Subarjo',
        status: 'Available',
        rackName: 'Rak 4',
        rowNumber: 2,
        filePositionNumber: '05',
      },
    ];

    service.extractKeywords.mockReturnValue(keywords);
    service.findMatches.mockResolvedValue(matches);
    service.buildTtsPayload.mockReturnValue('Arsip ditemukan. Perkara Pid.B nomor empat puluh lima tahun dua ribu dua puluh enam. Berada di Rak 4, Baris dua, nomor arsip kosong lima.');

    const result = await controller.search({ raw_transcript: 'cari perkara pidana biasa nomor 45' });

    expect(service.extractKeywords).toHaveBeenCalledWith('cari perkara pidana biasa nomor 45');
    expect(service.findMatches).toHaveBeenCalledWith(keywords);
    expect(result.status).toBe('success');
    expect(result.match_count).toBe(1);
    expect(result.data[0].case_number_raw).toBe('45/Pid.B/2026/PN.Bks');
    expect(result.data[0].location).toEqual({ rack: 'Rak 4', row: 2, position: '05' });
    expect(result.tts_payload).toContain('Arsip ditemukan');
  });

  it('returns null location when a match has no shelf', async () => {
    service.extractKeywords.mockReturnValue({ year: null, caseType: null, caseNumber: null, nameTokens: ['budi'] });
    service.findMatches.mockResolvedValue([
      {
        id: 2,
        caseNumberRaw: '99/Pdt.G/2026/PN.Bks',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'Budi',
        status: 'Available',
        rackName: null,
        rowNumber: null,
        filePositionNumber: null,
      },
    ]);
    service.buildTtsPayload.mockReturnValue('Arsip ditemukan. Perkara Pdt.G nomor sembilan puluh sembilan tahun dua ribu dua puluh enam. Lokasi rak belum ditentukan.');

    const result = await controller.search({ raw_transcript: 'cari budi' });

    expect(result.data[0].location).toBeNull();
  });

  it('returns an empty data array and zero match_count when nothing is found', async () => {
    service.extractKeywords.mockReturnValue({ year: null, caseType: null, caseNumber: null, nameTokens: ['zzz'] });
    service.findMatches.mockResolvedValue([]);
    service.buildTtsPayload.mockReturnValue('Arsip tidak ditemukan.');

    const result = await controller.search({ raw_transcript: 'cari zzz' });

    expect(result.match_count).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.tts_payload).toBe('Arsip tidak ditemukan.');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/search/search.controller.spec.ts`
Expected: FAIL — `Cannot find module './search.controller'`

- [ ] **Step 4: Write SearchController**

Create `src/search/search.controller.ts`:

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';

@Controller('archive')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post('search')
  @Roles('admin', 'petugas')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchDto) {
    const keywords = this.searchService.extractKeywords(dto.raw_transcript);
    const matches = await this.searchService.findMatches(keywords);
    const ttsPayload = this.searchService.buildTtsPayload(matches);

    return {
      status: 'success',
      match_count: matches.length,
      tts_payload: ttsPayload,
      data: matches.map((match) => ({
        id: match.id,
        case_number_raw: match.caseNumberRaw,
        case_type: match.caseType,
        year: match.year,
        parties_involved: match.partiesInvolved,
        status: match.status,
        location:
          match.rackName === null || match.rowNumber === null
            ? null
            : { rack: match.rackName, row: match.rowNumber, position: match.filePositionNumber },
        tts_payload: this.searchService.buildTtsPayload([match]),
      })),
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/search/search.controller.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write SearchModule and wire it into AppModule**

Create `src/search/search.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { NumberWordsService } from './number-words.service';
import { CaseTypeLookupService } from './case-type-lookup.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SearchController],
  providers: [SearchService, NumberWordsService, CaseTypeLookupService],
})
export class SearchModule {}
```

Edit `src/app.module.ts` to add `SearchModule` to the existing `imports` array (alongside `PrismaModule`, `AuthModule`, `ShelvesModule`, `CasesModule`).

- [ ] **Step 7: Run the full unit suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 8: Write an e2e test proving the search endpoint against real seeded data**

Create `test/search.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let petugasToken: string;
  let caseId: number;
  let shelfId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const petugasLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'petugas1', password: 'petugas123' });
    petugasToken = petugasLogin.body.token;

    const shelf = await prisma.shelf.create({ data: { rackName: 'Rak Uji', rowNumber: 9 } });
    shelfId = shelf.id;

    const created = await prisma.courtCase.create({
      data: {
        caseNumberRaw: '77/Pid.B/2026/PN.Test',
        caseNumberClean: '77',
        caseType: 'Pid.B',
        year: 2026,
        partiesInvolved: 'Zaenal Search Test',
        shelfId,
        filePositionNumber: '03',
      },
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.courtCase.delete({ where: { id: caseId } });
    await prisma.shelf.delete({ where: { id: shelfId } });
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/archive/search')
      .send({ raw_transcript: 'cari zaenal' })
      .expect(401);
  });

  it('finds the seeded case by party name and returns a spoken location', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/archive/search')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ raw_transcript: 'cari zaenal search test' })
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.match_count).toBeGreaterThanOrEqual(1);
    const found = response.body.data.find((item: { id: number }) => item.id === caseId);
    expect(found).toBeDefined();
    expect(found.location).toEqual({ rack: 'Rak Uji', row: 9, position: '03' });
  });

  it('returns a not-found tts_payload for a transcript matching nothing', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/archive/search')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ raw_transcript: 'cari xxxxxxxxxxxxxxxnotarealname' })
      .expect(200);

    expect(response.body.match_count).toBe(0);
    expect(response.body.tts_payload).toBe('Arsip tidak ditemukan.');
  });
});
```

- [ ] **Step 9: Run the e2e test**

Run: `npm run test:e2e`
Expected: PASS — all e2e files together, including the 3 new scenarios in `search.e2e-spec.ts`.

- [ ] **Step 10: Commit**

```bash
git add court-archive-backend/src/search/ court-archive-backend/src/app.module.ts court-archive-backend/test/search.e2e-spec.ts
git commit -m "feat: add POST /api/v1/archive/search endpoint with tts_payload"
```

---

## Plan Complete — What Exists Now

- `POST /api/v1/archive/search` (Admin + Petugas) accepting a raw STT transcript, normalizing Indonesian number words and case-type phrases, running a `pg_trgm` fuzzy-similarity query against `court_cases`/`shelves`, and returning ranked results with per-result and top-level `tts_payload` strings ready for the frontend's `speechSynthesis` call.
- `NumberWordsService` (bidirectional word↔integer, 0–9,999) and `CaseTypeLookupService` (exact-match lookup) as clean, independently-tested units reusable by future plans.
- The 0/1/multi-match branching from PRD FR-3.2 fully implemented and e2e-verified against real seeded data.

**Not yet built (deferred to Plan 4):** the entire frontend — Next.js UI, Web Speech API integration (STT capture, TTS playback), PWA manifest/service worker, responsive layout.
