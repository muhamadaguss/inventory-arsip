# Auth + Voice Search Frontend Core (Plan 4 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `court-archive-frontend/` Next.js app from scratch with login, JWT-protected routing, and the core hands-free voice search experience — microphone capture via `SpeechRecognition`, POST to the existing `/api/v1/archive/search` endpoint, giant-text result display with Available/Borrowed color states, spoken `tts_payload` playback via `SpeechSynthesis`, and a status toggle button — per PRD Sections 4.1, 4.3, 4.4, 7 and TSD Sections 2, 6, 7.

**Architecture:** Next.js 15 App Router with Tailwind CSS for styling. Redux Toolkit holds two slices: `auth` (JWT token + role) and `search` (last query, results, loading/error state). `redux-persist` persists the `auth` slice to `localStorage` so a page refresh doesn't log the user out. Two custom hooks wrap the Web Speech API: `useSpeechRecognition` (STT capture with browser-support detection and text-input fallback) and `useSpeechSynthesis` (TTS playback with a stop/mute control). A thin `apiClient` module wraps `fetch` with the `Authorization: Bearer <token>` header and the backend's base URL from an env var.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Redux Toolkit + `react-redux`, `redux-persist`, Jest + React Testing Library (component/hook tests), no new voice-processing libraries (Web Speech API is a browser global, not an npm package).

## Global Constraints

- All STT/TTS operations use the `id-ID` locale exclusively (PRD NFR-1) — `recognition.lang = 'id-ID'` and `utterance.lang = 'id-ID'` are set on every instance, no exceptions.
- No anonymous access to any authenticated page — every route except `/login` redirects to `/login` when no JWT is present in the Redux `auth` slice (PRD FR-5.1).
- Backend base URL comes from `process.env.NEXT_PUBLIC_API_BASE_URL`, read only inside `apiClient` — no component calls `fetch` directly against a hardcoded URL.
- Browser compatibility fallback is mandatory, not optional (PRD FR-7.1–7.2, TSD Section 7): on mount, feature-detect `window.SpeechRecognition || window.webkitSpeechRecognition`; if absent, hide the mic button and render a text `<input>` that posts to the same search flow. Independently feature-detect `window.speechSynthesis`; if absent, skip audio playback and show the result as text only — this check must never block search results from displaying.
- High-contrast status colors are fixed by PRD FR-4.2: green background = `Available`, red background = `Borrowed`. No other colors represent case status.
- Giant text (PRD FR-4.1) applies to the RAK (rack name) and NOMOR ARSIP (file position number) in the result display — implemented with a large Tailwind text utility (e.g., `text-5xl` or larger), not a fixed pixel value.
- Mobile-first responsive layout (PRD NFR-4, TSD Section 7.1): single-column, bottom-anchored mic button below Tailwind's `md` (768px) breakpoint; centered max-width layout at/above it. This plan does not implement the PWA manifest/service worker — that is Plan 6.
- Repository is the monorepo `court-archive-frontend/` subfolder inside `inventory-arsip` — every commit in this plan is scoped to paths under `court-archive-frontend/`. This is a brand-new folder; Task 1 creates it.
- Git workflow: this plan branches from `develop` (gitflow, TSD Section 9) — not `main`. Every task's commits land on a feature branch cut from `develop`; the plan does not merge to `main` directly.
- Consumes the backend's existing `POST /api/v1/archive/search` and `POST /api/v1/auth/login` endpoints (already implemented in `court-archive-backend`) exactly as documented in TSD Section 5 — this plan does not modify backend code.
- Status toggle (PRD FR-4.3) calls the existing `PATCH /api/v1/archive/cases/:id/status` endpoint — already implemented, Admin + Petugas accessible.

---

## File Structure

```
court-archive-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout: Redux Provider, PersistGate, metadata
│   │   ├── page.tsx                   # Redirects to /search or /login based on auth state
│   │   ├── login/
│   │   │   └── page.tsx               # Login form page
│   │   └── search/
│   │       └── page.tsx               # Main voice search page (protected route)
│   ├── store/
│   │   ├── store.ts                   # Redux store config + persistReducer
│   │   ├── authSlice.ts               # token, role, login/logout actions
│   │   ├── authSlice.test.ts
│   │   ├── searchSlice.ts             # query, results, status, error
│   │   └── searchSlice.test.ts
│   ├── lib/
│   │   ├── apiClient.ts               # fetch wrapper with auth header
│   │   └── apiClient.test.ts
│   ├── hooks/
│   │   ├── useSpeechRecognition.ts    # STT capture + browser detection
│   │   ├── useSpeechRecognition.test.ts
│   │   ├── useSpeechSynthesis.ts      # TTS playback + stop control
│   │   └── useSpeechSynthesis.test.ts
│   └── components/
│       ├── ProtectedRoute.tsx         # Redirect-if-no-token wrapper
│       ├── LoginForm.tsx
│       ├── LoginForm.test.tsx
│       ├── SearchBar.tsx              # Mic button + text fallback input
│       ├── SearchBar.test.tsx
│       ├── ResultCard.tsx             # Giant text RAK/NOMOR + color state
│       ├── ResultCard.test.tsx
│       ├── StatusToggleButton.tsx
│       └── StatusToggleButton.test.tsx
├── jest.config.ts
├── jest.setup.ts
├── package.json
├── tsconfig.json
└── .env.local.example
```

Each file's responsibility:
- `store/authSlice.ts` — pure Redux slice: `token`, `role`, `login(token, role)`, `logout()`. No side effects, no fetch calls.
- `store/searchSlice.ts` — pure Redux slice: `query`, `results`, `status` (`'idle' | 'loading' | 'success' | 'error'`), `error`. No fetch calls — the search page component calls `apiClient` and dispatches the result.
- `lib/apiClient.ts` — the only module that calls `fetch`. Reads the JWT from the Redux store (passed in as a parameter, not imported directly, to keep it testable) and the base URL from the env var.
- `hooks/useSpeechRecognition.ts` — wraps `SpeechRecognition`/`webkitSpeechRecognition`; returns `{ isSupported, isListening, transcript, start, stop }`.
- `hooks/useSpeechSynthesis.ts` — wraps `speechSynthesis`; returns `{ isSupported, isSpeaking, speak(text), stop() }`.
- `components/SearchBar.tsx` — renders mic button when `useSpeechRecognition().isSupported`, else a text `<input>` + submit button; both paths end by calling the same `onSearch(transcript: string)` prop.
- `components/ResultCard.tsx` — takes one search result object, renders RAK/NOMOR in giant text, background color from `status`, and triggers `useSpeechSynthesis().speak()` on mount for the top-level `tts_payload`.
- `components/StatusToggleButton.tsx` — calls `PATCH /archive/cases/:id/status`, optimistically flips the displayed status.

---

### Task 1: Next.js app scaffold with Tailwind, Redux Toolkit, and redux-persist

**Files:**
- Create: `court-archive-frontend/package.json`
- Create: `court-archive-frontend/tsconfig.json`
- Create: `court-archive-frontend/next.config.ts`
- Create: `court-archive-frontend/jest.config.ts`
- Create: `court-archive-frontend/jest.setup.ts`
- Create: `court-archive-frontend/src/app/layout.tsx`
- Create: `court-archive-frontend/src/app/page.tsx`
- Create: `court-archive-frontend/src/app/globals.css`
- Create: `court-archive-frontend/src/store/store.ts`
- Create: `court-archive-frontend/.env.local.example`
- Create: `court-archive-frontend/.gitignore`

**Interfaces:**
- Produces: the Redux `store` (default export from `store/store.ts`) with a `persistor` named export, wired into `app/layout.tsx` via `<Provider>` and `<PersistGate>`. Consumed by every subsequent task's components/hooks via `react-redux`'s `useSelector`/`useDispatch`.
- Produces: root `page.tsx` — a client component that reads `auth.token` from the store and calls `redirect('/search')` or `redirect('/login')` (Next.js `useRouter().replace`, since `redirect()` from `next/navigation` cannot run conditionally in a client component body).

- [ ] **Step 1: Scaffold the Next.js app**

From the repo root (`inventory-arsip/`), run:

```bash
npx create-next-app@15 court-archive-frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --turbopack
```

When prompted, accept the default answers. This creates `court-archive-frontend/` with `src/` disabled — immediately after, move everything under a `src/` dir to match this plan's file structure:

```bash
cd court-archive-frontend
mkdir src
git mv app src/app 2>/dev/null || mv app src/app
```

Update `tsconfig.json`'s `"paths"` entry for `@/*` to point at `["./src/*"]` (create-next-app with `--no-src-dir` sets it to `["./*"]`).

- [ ] **Step 2: Install Redux Toolkit, redux-persist, and test dependencies**

```bash
npm install @reduxjs/toolkit react-redux redux-persist
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest ts-node
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  setupFilesAfterEach: [],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default createJestConfig(config);
```

Create `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

Add to `package.json` `scripts`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Write the Redux store**

Create `src/store/store.ts`:

```typescript
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from './authSlice';
import searchReducer from './searchSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  search: searchReducer,
});

const persistConfig = {
  key: 'court-archive-root',
  storage,
  whitelist: ['auth'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

This references `authSlice` and `searchSlice`, which don't exist yet — that's expected; Task 2 creates `authSlice.ts` and Task 5 creates `searchSlice.ts`. For this task, create minimal placeholder slices so the app compiles:

Create `src/store/authSlice.ts` (Task 2 will expand this):

```typescript
import { createSlice } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  role: 'admin' | 'petugas' | null;
}

const initialState: AuthState = { token: null, role: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
});

export default authSlice.reducer;
```

Create `src/store/searchSlice.ts` (Task 5 will expand this):

```typescript
import { createSlice } from '@reduxjs/toolkit';

interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
}

const initialState: SearchState = { status: 'idle' };

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {},
});

export default searchSlice.reducer;
```

- [ ] **Step 5: Wire the store into the root layout**

Create `src/app/providers.tsx` (a client component boundary, since `layout.tsx` itself can stay a server component for metadata export):

```typescript
'use client';

import { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/store/store';

export function Providers({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
```

Edit `src/app/layout.tsx` to wrap `children` with `<Providers>`:

```typescript
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Arsip Perkara Suara',
  description: 'Voice-activated court case archive inventory system',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Write the root redirect page**

Create `src/app/page.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

export default function RootPage() {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    router.replace(token ? '/search' : '/login');
  }, [token, router]);

  return null;
}
```

- [ ] **Step 7: Set up the env var and .gitignore**

Create `.env.local.example`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

Verify `.gitignore` (generated by `create-next-app`) includes `.env*.local` and `node_modules` — it does by default; no edit needed unless missing.

- [ ] **Step 8: Verify the app builds and runs**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add court-archive-frontend/
git commit -m "feat: scaffold Next.js frontend with Redux Toolkit and redux-persist"
```

---

### Task 2: Auth slice, login page, and API client

**Files:**
- Modify: `src/store/authSlice.ts`
- Create: `src/store/authSlice.test.ts`
- Create: `src/lib/apiClient.ts`
- Create: `src/lib/apiClient.test.ts`
- Create: `src/components/LoginForm.tsx`
- Create: `src/components/LoginForm.test.tsx`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `RootState` (Task 1).
- Produces: `authSlice.actions.login({ token: string; role: 'admin' | 'petugas' })`, `authSlice.actions.logout()`. Produces: `apiClient.login(username: string, password: string): Promise<{ token: string; role: 'admin' | 'petugas' }>` — throws an `Error` with the backend's error message on non-2xx response. Produces: `apiClient.post<T>(path: string, body: unknown, token: string | null): Promise<T>` — the generic authenticated POST helper reused by Tasks 5 and 8. Consumed by `LoginForm` (this task) and `SearchBar`/`StatusToggleButton` (Tasks 5, 8).

- [ ] **Step 1: Write the failing authSlice tests**

Create `src/store/authSlice.test.ts`:

```typescript
import reducer, { login, logout } from './authSlice';

describe('authSlice', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      token: null,
      role: null,
    });
  });

  it('sets token and role on login', () => {
    const state = reducer(
      { token: null, role: null },
      login({ token: 'abc123', role: 'petugas' }),
    );
    expect(state).toEqual({ token: 'abc123', role: 'petugas' });
  });

  it('clears token and role on logout', () => {
    const state = reducer(
      { token: 'abc123', role: 'admin' },
      logout(),
    );
    expect(state).toEqual({ token: null, role: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/authSlice.test.ts`
Expected: FAIL — `login is not exported`

- [ ] **Step 3: Expand authSlice with login/logout actions**

Replace `src/store/authSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  token: string | null;
  role: 'admin' | 'petugas' | null;
}

const initialState: AuthState = { token: null, role: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (
      state,
      action: PayloadAction<{ token: string; role: 'admin' | 'petugas' }>,
    ) => {
      state.token = action.payload.token;
      state.role = action.payload.role;
    },
    logout: (state) => {
      state.token = null;
      state.role = null;
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/authSlice.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing apiClient tests**

Create `src/lib/apiClient.test.ts`:

```typescript
import { login, post } from './apiClient';

describe('apiClient.login', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('posts credentials and returns token+role on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'abc123', role: 'petugas' }),
    });

    const result = await login('petugas1', 'petugas123');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ username: 'petugas1', password: 'petugas123' }),
      }),
    );
    expect(result).toEqual({ token: 'abc123', role: 'petugas' });
  });

  it('throws with the server message on a non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    });

    await expect(login('bad', 'creds')).rejects.toThrow('Invalid credentials');
  });
});

describe('apiClient.post', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sends an Authorization header when a token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });

    await post('/archive/search', { raw_transcript: 'cari budi' }, 'my-token');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/archive/search'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('omits the Authorization header when token is null', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });

    await post('/auth/login', { username: 'a', password: 'b' }, null);

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('throws with the server message on a non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    await expect(post('/archive/cases', {}, 'token')).rejects.toThrow('Forbidden');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx jest src/lib/apiClient.test.ts`
Expected: FAIL — `Cannot find module './apiClient'`

- [ ] **Step 7: Write apiClient**

Create `src/lib/apiClient.ts`:

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}

export async function post<T>(
  path: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function patch<T>(
  path: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function login(
  username: string,
  password: string,
): Promise<{ token: string; role: 'admin' | 'petugas' }> {
  return post('/auth/login', { username, password }, null);
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/lib/apiClient.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Write the failing LoginForm test**

Create `src/components/LoginForm.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { LoginForm } from './LoginForm';
import * as apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

function renderWithStore() {
  const store = configureStore({ reducer: { auth: authReducer } });
  render(
    <Provider store={store}>
      <LoginForm />
    </Provider>,
  );
  return store;
}

describe('LoginForm', () => {
  it('submits username and password and dispatches login on success', async () => {
    (apiClient.login as jest.Mock).mockResolvedValue({
      token: 'abc123',
      role: 'petugas',
    });
    const store = renderWithStore();

    await userEvent.type(screen.getByLabelText(/username/i), 'petugas1');
    await userEvent.type(screen.getByLabelText(/password/i), 'petugas123');
    await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

    expect(apiClient.login).toHaveBeenCalledWith('petugas1', 'petugas123');
    expect(store.getState().auth).toEqual({ token: 'abc123', role: 'petugas' });
  });

  it('shows an error message when login fails', async () => {
    (apiClient.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));
    renderWithStore();

    await userEvent.type(screen.getByLabelText(/username/i), 'bad');
    await userEvent.type(screen.getByLabelText(/password/i), 'creds');
    await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx jest src/components/LoginForm.test.tsx`
Expected: FAIL — `Cannot find module './LoginForm'`

- [ ] **Step 11: Write LoginForm**

Create `src/components/LoginForm.tsx`:

```typescript
'use client';

import { FormEvent, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { login as loginAction } from '@/store/authSlice';
import { login as loginRequest } from '@/lib/apiClient';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await loginRequest(username, password);
      dispatch(loginAction(result));
      router.replace('/search');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          required
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        className="rounded bg-blue-700 px-4 py-2 text-white font-semibold"
      >
        Masuk
      </button>
    </form>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx jest src/components/LoginForm.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 13: Write the login page**

Create `src/app/login/page.tsx`:

```typescript
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#0B1220] text-white">
      <h1 className="text-2xl font-bold mb-6">Arsip Perkara Suara</h1>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 14: Commit**

```bash
git add court-archive-frontend/src/store/authSlice.ts court-archive-frontend/src/store/authSlice.test.ts court-archive-frontend/src/lib/apiClient.ts court-archive-frontend/src/lib/apiClient.test.ts court-archive-frontend/src/components/LoginForm.tsx court-archive-frontend/src/components/LoginForm.test.tsx court-archive-frontend/src/app/login/page.tsx
git commit -m "feat: add auth slice, API client, and login page"
```

---

### Task 3: Protected route wrapper and role-aware navigation guard

**Files:**
- Create: `src/components/ProtectedRoute.tsx`
- Create: `src/components/ProtectedRoute.test.tsx`
- Modify: `src/app/search/page.tsx` (created as a stub in this task, expanded in Task 5)

**Interfaces:**
- Consumes: `RootState.auth.token` (Task 2).
- Produces: `ProtectedRoute` — a client component that takes `children: ReactNode` and either renders them (token present) or redirects to `/login` (token absent). Consumed by `app/search/page.tsx` (this task, and every protected page in later plans).

- [ ] **Step 1: Write the failing ProtectedRoute test**

Create `src/components/ProtectedRoute.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { ProtectedRoute } from './ProtectedRoute';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function renderWithAuth(token: string | null) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token, role: token ? 'petugas' : null } },
  });
  return render(
    <Provider store={store}>
      <ProtectedRoute>
        <p>Protected content</p>
      </ProtectedRoute>
    </Provider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('renders children when a token is present', () => {
    renderWithAuth('abc123');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /login when no token is present', () => {
    renderWithAuth(null);
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ProtectedRoute.test.tsx`
Expected: FAIL — `Cannot find module './ProtectedRoute'`

- [ ] **Step 3: Write ProtectedRoute**

Create `src/components/ProtectedRoute.tsx`:

```typescript
'use client';

import { PropsWithChildren, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  if (!token) {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/ProtectedRoute.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Create a stub protected search page**

Create `src/app/search/page.tsx`:

```typescript
'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function SearchPage() {
  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col items-center p-6">
        <h1 className="text-2xl font-bold">Cari Arsip</h1>
      </main>
    </ProtectedRoute>
  );
}
```

This is a stub — Task 5 replaces the body with the real search UI. Its purpose here is to prove `ProtectedRoute` wires into a real route before later tasks build on top of it.

- [ ] **Step 6: Verify the app still builds**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add court-archive-frontend/src/components/ProtectedRoute.tsx court-archive-frontend/src/components/ProtectedRoute.test.tsx court-archive-frontend/src/app/search/page.tsx
git commit -m "feat: add protected route wrapper and stub search page"
```

---

### Task 4: useSpeechRecognition hook (STT capture + browser fallback)

**Files:**
- Create: `src/hooks/useSpeechRecognition.ts`
- Create: `src/hooks/useSpeechRecognition.test.ts`

**Interfaces:**
- Produces: `useSpeechRecognition(): { isSupported: boolean; isListening: boolean; transcript: string; start: () => void; stop: () => void }`. `isSupported` is `false` when neither `window.SpeechRecognition` nor `window.webkitSpeechRecognition` exist (PRD FR-7.1). Consumed by `SearchBar` (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useSpeechRecognition.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
}

describe('useSpeechRecognition', () => {
  const originalSpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition;

  afterEach(() => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = originalSpeechRecognition;
  });

  it('reports unsupported when SpeechRecognition is absent', () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(false);
  });

  it('sets lang to id-ID and starts listening on start()', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(true);

    act(() => {
      result.current.start();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('captures the transcript from a recognition result event', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    const instance = (result.current as unknown as { _instance: MockSpeechRecognition })._instance;
    act(() => {
      instance.onresult?.({
        results: [[{ transcript: 'cari perkara pidana nomor lima' }]],
      });
    });

    expect(result.current.transcript).toBe('cari perkara pidana nomor lima');
  });

  it('stops listening on stop()', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.isListening).toBe(false);
  });
});
```

Note: the third test reaches into a `_instance` escape hatch. Step 3's implementation must expose the current recognition instance on the returned object under that key, purely for testability — it is not part of the public interface documented above and other tasks must not rely on it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/hooks/useSpeechRecognition.test.ts`
Expected: FAIL — `Cannot find module './useSpeechRecognition'`

- [ ] **Step 3: Write useSpeechRecognition**

Create `src/hooks/useSpeechRecognition.ts`:

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  _instance: SpeechRecognitionLike | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setIsSupported(Boolean(RecognitionCtor));
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      return;
    }

    const instance = new RecognitionCtor();
    instance.lang = 'id-ID';
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
    };
    instance.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = instance;
    instance.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    start,
    stop,
    _instance: recognitionRef.current,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/hooks/useSpeechRecognition.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add court-archive-frontend/src/hooks/useSpeechRecognition.ts court-archive-frontend/src/hooks/useSpeechRecognition.test.ts
git commit -m "feat: add useSpeechRecognition hook with browser support detection"
```

---

### Task 5: Search slice, SearchBar component, and search page wiring

**Files:**
- Modify: `src/store/searchSlice.ts`
- Create: `src/store/searchSlice.test.ts`
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/SearchBar.test.tsx`
- Modify: `src/app/search/page.tsx`

**Interfaces:**
- Consumes: `useSpeechRecognition` (Task 4), `apiClient.post` (Task 2), `RootState.auth.token` (Task 2).
- Produces: `searchSlice.actions.searchStart()`, `searchSlice.actions.searchSuccess(payload: SearchResponse)`, `searchSlice.actions.searchFailure(error: string)` where `SearchResponse = { status: 'success'; match_count: number; tts_payload: string; data: CaseResult[] }` and `CaseResult = { id: number; case_number_raw: string; case_type: string; year: number; parties_involved: string; status: 'Available' | 'Borrowed'; location: { rack: string; row: number; position: string | null } | null; tts_payload: string }` — this exact shape matches the backend's `SearchController` response (`court-archive-backend/src/search/search.controller.ts`). Produces: `SearchBar` component with prop `onSearch: (transcript: string) => void`. Consumed by `ResultCard` (Task 6) reading `search.results` from the store.

- [ ] **Step 1: Write the failing searchSlice tests**

Create `src/store/searchSlice.test.ts`:

```typescript
import reducer, { searchStart, searchSuccess, searchFailure } from './searchSlice';

const samplePayload = {
  status: 'success' as const,
  match_count: 1,
  tts_payload: 'Arsip ditemukan.',
  data: [
    {
      id: 1,
      case_number_raw: '45/Pid.B/2026/PN.Bks',
      case_type: 'Pid.B',
      year: 2026,
      parties_involved: 'Ahmad Subarjo',
      status: 'Available' as const,
      location: { rack: 'Rak 4', row: 2, position: '05' },
      tts_payload: 'Arsip ditemukan. Berada di Rak 4.',
    },
  ],
};

describe('searchSlice', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      status: 'idle',
      results: [],
      matchCount: 0,
      ttsPayload: null,
      error: null,
    });
  });

  it('sets status to loading on searchStart', () => {
    const state = reducer(
      { status: 'idle', results: [], matchCount: 0, ttsPayload: null, error: null },
      searchStart(),
    );
    expect(state.status).toBe('loading');
  });

  it('stores results on searchSuccess', () => {
    const state = reducer(
      { status: 'loading', results: [], matchCount: 0, ttsPayload: null, error: null },
      searchSuccess(samplePayload),
    );
    expect(state.status).toBe('success');
    expect(state.results).toEqual(samplePayload.data);
    expect(state.matchCount).toBe(1);
    expect(state.ttsPayload).toBe('Arsip ditemukan.');
  });

  it('stores the error message on searchFailure', () => {
    const state = reducer(
      { status: 'loading', results: [], matchCount: 0, ttsPayload: null, error: null },
      searchFailure('Network error'),
    );
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/searchSlice.test.ts`
Expected: FAIL — `searchStart is not exported`

- [ ] **Step 3: Expand searchSlice**

Replace `src/store/searchSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CaseResult {
  id: number;
  case_number_raw: string;
  case_type: string;
  year: number;
  parties_involved: string;
  status: 'Available' | 'Borrowed';
  location: { rack: string; row: number; position: string | null } | null;
  tts_payload: string;
}

export interface SearchResponse {
  status: 'success';
  match_count: number;
  tts_payload: string;
  data: CaseResult[];
}

interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
  results: CaseResult[];
  matchCount: number;
  ttsPayload: string | null;
  error: string | null;
}

const initialState: SearchState = {
  status: 'idle',
  results: [],
  matchCount: 0,
  ttsPayload: null,
  error: null,
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    searchStart: (state) => {
      state.status = 'loading';
      state.error = null;
    },
    searchSuccess: (state, action: PayloadAction<SearchResponse>) => {
      state.status = 'success';
      state.results = action.payload.data;
      state.matchCount = action.payload.match_count;
      state.ttsPayload = action.payload.tts_payload;
    },
    searchFailure: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
  },
});

export const { searchStart, searchSuccess, searchFailure } = searchSlice.actions;
export default searchSlice.reducer;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/searchSlice.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing SearchBar tests**

Create `src/components/SearchBar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

const mockStart = jest.fn();
const mockStop = jest.fn();
let mockIsSupported = true;
let mockTranscript = '';

jest.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isSupported: mockIsSupported,
    isListening: false,
    transcript: mockTranscript,
    start: mockStart,
    stop: mockStop,
  }),
}));

describe('SearchBar', () => {
  beforeEach(() => {
    mockIsSupported = true;
    mockTranscript = '';
    mockStart.mockClear();
  });

  it('renders a mic button when SpeechRecognition is supported', () => {
    render(<SearchBar onSearch={jest.fn()} />);
    expect(screen.getByRole('button', { name: /mulai bicara/i })).toBeInTheDocument();
  });

  it('calls start() when the mic button is clicked', async () => {
    render(<SearchBar onSearch={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /mulai bicara/i }));
    expect(mockStart).toHaveBeenCalled();
  });

  it('calls onSearch with the transcript once captured', () => {
    mockTranscript = 'cari budi';
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    expect(onSearch).toHaveBeenCalledWith('cari budi');
  });

  it('renders a text input instead of a mic button when unsupported', () => {
    mockIsSupported = false;
    render(<SearchBar onSearch={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /mulai bicara/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/cari arsip/i)).toBeInTheDocument();
  });

  it('calls onSearch with the typed value on text form submit', async () => {
    mockIsSupported = false;
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText(/cari arsip/i), 'cari budi{enter}');
    expect(onSearch).toHaveBeenCalledWith('cari budi');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx jest src/components/SearchBar.test.tsx`
Expected: FAIL — `Cannot find module './SearchBar'`

- [ ] **Step 7: Write SearchBar**

Create `src/components/SearchBar.tsx`:

```typescript
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface SearchBarProps {
  onSearch: (transcript: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const { isSupported, isListening, transcript, start } = useSpeechRecognition();
  const [textValue, setTextValue] = useState('');
  const lastSubmittedTranscript = useRef('');

  useEffect(() => {
    if (transcript && transcript !== lastSubmittedTranscript.current) {
      lastSubmittedTranscript.current = transcript;
      onSearch(transcript);
    }
  }, [transcript, onSearch]);

  function handleTextSubmit(event: FormEvent) {
    event.preventDefault();
    if (textValue.trim()) {
      onSearch(textValue.trim());
    }
  }

  if (isSupported) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={isListening}
        className="rounded-full bg-blue-700 text-white w-20 h-20 flex items-center justify-center text-sm font-semibold fixed bottom-8 left-1/2 -translate-x-1/2 md:static md:translate-x-0"
      >
        {isListening ? 'Mendengarkan...' : 'Mulai Bicara'}
      </button>
    );
  }

  return (
    <form onSubmit={handleTextSubmit} className="w-full max-w-md">
      <label htmlFor="text-search" className="block text-sm font-medium mb-1">
        Cari Arsip
      </label>
      <input
        id="text-search"
        type="text"
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        className="w-full rounded border px-3 py-2"
        placeholder="cari perkara pidana nomor 45 tahun 2026 atas nama ahmad"
      />
    </form>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/components/SearchBar.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 9: Wire SearchBar into the search page**

Replace `src/app/search/page.tsx`:

```typescript
'use client';

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SearchBar } from '@/components/SearchBar';
import { post } from '@/lib/apiClient';
import { searchStart, searchSuccess, searchFailure } from '@/store/searchSlice';
import type { SearchResponse } from '@/store/searchSlice';
import type { RootState } from '@/store/store';

export default function SearchPage() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);

  const handleSearch = useCallback(
    async (transcript: string) => {
      dispatch(searchStart());
      try {
        const result = await post<SearchResponse>(
          '/archive/search',
          { raw_transcript: transcript },
          token,
        );
        dispatch(searchSuccess(result));
      } catch (err) {
        dispatch(searchFailure(err instanceof Error ? err.message : 'Pencarian gagal'));
      }
    },
    [dispatch, token],
  );

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col items-center p-6 gap-8">
        <h1 className="text-2xl font-bold">Cari Arsip</h1>
        <SearchBar onSearch={handleSearch} />
      </main>
    </ProtectedRoute>
  );
}
```

- [ ] **Step 10: Verify the app still builds**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add court-archive-frontend/src/store/searchSlice.ts court-archive-frontend/src/store/searchSlice.test.ts court-archive-frontend/src/components/SearchBar.tsx court-archive-frontend/src/components/SearchBar.test.tsx court-archive-frontend/src/app/search/page.tsx
git commit -m "feat: add search slice, SearchBar component, and wire search page to backend"
```

---

### Task 6: ResultCard — giant text display with Available/Borrowed color states

**Files:**
- Create: `src/components/ResultCard.tsx`
- Create: `src/components/ResultCard.test.tsx`
- Modify: `src/app/search/page.tsx`

**Interfaces:**
- Consumes: `CaseResult` (Task 5), `RootState.search.results` (Task 5).
- Produces: `ResultCard` component with prop `result: CaseResult`. Renders giant text for `location.rack` and `location.position`; background color `bg-green-600` when `status === 'Available'`, `bg-red-600` when `Borrowed`. Consumed by `search/page.tsx` (this task), which maps `search.results` to a list of `ResultCard`s.

- [ ] **Step 1: Write the failing ResultCard tests**

Create `src/components/ResultCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import type { CaseResult } from '@/store/searchSlice';

const availableResult: CaseResult = {
  id: 1,
  case_number_raw: '45/Pid.B/2026/PN.Bks',
  case_type: 'Pid.B',
  year: 2026,
  parties_involved: 'Ahmad Subarjo',
  status: 'Available',
  location: { rack: 'Rak 4', row: 2, position: '05' },
  tts_payload: 'Arsip ditemukan.',
};

describe('ResultCard', () => {
  it('renders the rack and position in giant text', () => {
    render(<ResultCard result={availableResult} />);
    expect(screen.getByText('Rak 4')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('applies a green background when status is Available', () => {
    render(<ResultCard result={availableResult} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-green-600');
  });

  it('applies a red background when status is Borrowed', () => {
    render(<ResultCard result={{ ...availableResult, status: 'Borrowed' }} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-red-600');
  });

  it('shows a fallback message when location is null', () => {
    render(<ResultCard result={{ ...availableResult, location: null }} />);
    expect(screen.getByText(/lokasi rak belum ditentukan/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/ResultCard.test.tsx`
Expected: FAIL — `Cannot find module './ResultCard'`

- [ ] **Step 3: Write ResultCard**

Create `src/components/ResultCard.tsx`:

```typescript
import type { CaseResult } from '@/store/searchSlice';

interface ResultCardProps {
  result: CaseResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const bgClass = result.status === 'Available' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div
      data-testid="result-card"
      className={`${bgClass} text-white rounded-lg p-6 w-full max-w-xl flex flex-col gap-2`}
    >
      <p className="text-lg">
        Perkara {result.case_type} Nomor {result.case_number_raw} Tahun {result.year}
      </p>
      <p className="text-lg">{result.parties_involved}</p>
      {result.location ? (
        <>
          <p className="text-5xl md:text-6xl font-extrabold">{result.location.rack}</p>
          <p className="text-5xl md:text-6xl font-extrabold">
            {result.location.position ?? '-'}
          </p>
        </>
      ) : (
        <p className="text-2xl font-semibold">Lokasi rak belum ditentukan</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/ResultCard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Render the results list in the search page**

Edit `src/app/search/page.tsx` — add the import and render results below `<SearchBar>`:

```typescript
import { ResultCard } from '@/components/ResultCard';
```

Add inside the `<main>`, after `<SearchBar onSearch={handleSearch} />`:

```typescript
        <div className="flex flex-col items-center gap-4 w-full">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
```

Add the `results` selector alongside the existing `token` selector:

```typescript
  const results = useSelector((state: RootState) => state.search.results);
```

- [ ] **Step 6: Verify the app still builds**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add court-archive-frontend/src/components/ResultCard.tsx court-archive-frontend/src/components/ResultCard.test.tsx court-archive-frontend/src/app/search/page.tsx
git commit -m "feat: add ResultCard with giant text and Available/Borrowed color states"
```

---

### Task 7: useSpeechSynthesis hook and TTS playback with mute/stop control

**Files:**
- Create: `src/hooks/useSpeechSynthesis.ts`
- Create: `src/hooks/useSpeechSynthesis.test.ts`
- Modify: `src/app/search/page.tsx`

**Interfaces:**
- Produces: `useSpeechSynthesis(): { isSupported: boolean; isSpeaking: boolean; speak: (text: string) => void; stop: () => void }`. Sets `utterance.lang = 'id-ID'` (PRD NFR-1). Consumed by `search/page.tsx` (this task) to speak `search.ttsPayload` whenever it changes, with a stop button rendered per PRD FR-3.3.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useSpeechSynthesis.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  const originalSpeechSynthesis = (window as unknown as Record<string, unknown>).speechSynthesis;
  const originalUtterance = (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;

  afterEach(() => {
    (window as unknown as Record<string, unknown>).speechSynthesis = originalSpeechSynthesis;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = originalUtterance;
  });

  it('reports unsupported when speechSynthesis is absent', () => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;

    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isSupported).toBe(false);
  });

  it('speaks with id-ID locale when supported', () => {
    const mockSpeak = jest.fn();
    (window as unknown as Record<string, unknown>).speechSynthesis = {
      speak: mockSpeak,
      cancel: jest.fn(),
    };
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = jest
      .fn()
      .mockImplementation((text: string) => ({ text, lang: '' }));

    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Arsip ditemukan.');
    });

    expect(mockSpeak).toHaveBeenCalled();
    const utteranceArg = mockSpeak.mock.calls[0][0];
    expect(utteranceArg.lang).toBe('id-ID');
    expect(result.current.isSpeaking).toBe(true);
  });

  it('cancels speech on stop()', () => {
    const mockCancel = jest.fn();
    (window as unknown as Record<string, unknown>).speechSynthesis = {
      speak: jest.fn(),
      cancel: mockCancel,
    };
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = jest
      .fn()
      .mockImplementation((text: string) => ({ text, lang: '' }));

    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Arsip ditemukan.');
    });
    act(() => {
      result.current.stop();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/hooks/useSpeechSynthesis.test.ts`
Expected: FAIL — `Cannot find module './useSpeechSynthesis'`

- [ ] **Step 3: Write useSpeechSynthesis**

Create `src/hooks/useSpeechSynthesis.ts`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string) => {
    const w = window as unknown as {
      speechSynthesis?: { speak: (u: unknown) => void; cancel: () => void };
      SpeechSynthesisUtterance?: new (text: string) => { lang: string };
    };
    if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) {
      return;
    }

    const utterance = new w.SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    w.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, []);

  const stop = useCallback(() => {
    const w = window as unknown as { speechSynthesis?: { cancel: () => void } };
    w.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSupported, isSpeaking, speak, stop };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/hooks/useSpeechSynthesis.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire TTS playback into the search page**

Edit `src/app/search/page.tsx` — add the import, the hook, an effect that speaks `ttsPayload` when it changes, and a stop button:

```typescript
import { useEffect } from 'react';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
```

Add inside the component, alongside the existing `results` selector:

```typescript
  const ttsPayload = useSelector((state: RootState) => state.search.ttsPayload);
  const { isSupported: ttsSupported, isSpeaking, speak, stop } = useSpeechSynthesis();

  useEffect(() => {
    if (ttsPayload && ttsSupported) {
      speak(ttsPayload);
    }
  }, [ttsPayload, ttsSupported, speak]);
```

Add inside `<main>`, after the results list:

```typescript
        {isSpeaking && (
          <button
            type="button"
            onClick={stop}
            className="rounded bg-gray-700 text-white px-4 py-2 font-semibold"
          >
            Hentikan Suara
          </button>
        )}
```

- [ ] **Step 6: Verify the app still builds**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add court-archive-frontend/src/hooks/useSpeechSynthesis.ts court-archive-frontend/src/hooks/useSpeechSynthesis.test.ts court-archive-frontend/src/app/search/page.tsx
git commit -m "feat: add useSpeechSynthesis hook with TTS playback and stop control"
```

---

### Task 8: StatusToggleButton — Available/Borrowed toggle on the result screen

**Files:**
- Create: `src/components/StatusToggleButton.tsx`
- Create: `src/components/StatusToggleButton.test.tsx`
- Modify: `src/components/ResultCard.tsx`
- Modify: `src/components/ResultCard.test.tsx`

**Interfaces:**
- Consumes: `apiClient.patch` (Task 2), `RootState.auth.token` (Task 2).
- Produces: `StatusToggleButton` component with props `{ caseId: number; currentStatus: 'Available' | 'Borrowed'; onToggled: (newStatus: 'Available' | 'Borrowed') => void }` — calls `PATCH /archive/cases/:id/status` with the opposite status, then calls `onToggled` with the new value on success. Consumed by `ResultCard` (this task, modified), which renders it and updates its own displayed status.

- [ ] **Step 1: Write the failing StatusToggleButton tests**

Create `src/components/StatusToggleButton.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { StatusToggleButton } from './StatusToggleButton';
import * as apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token: 'my-token', role: 'petugas' as const } },
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('StatusToggleButton', () => {
  it('shows "Tandai Dipinjam" when status is Available', () => {
    renderWithStore(
      <StatusToggleButton caseId={1} currentStatus="Available" onToggled={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /tandai dipinjam/i })).toBeInTheDocument();
  });

  it('shows "Tandai Tersedia" when status is Borrowed', () => {
    renderWithStore(
      <StatusToggleButton caseId={1} currentStatus="Borrowed" onToggled={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /tandai tersedia/i })).toBeInTheDocument();
  });

  it('calls patch with the opposite status and onToggled on success', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({});
    const onToggled = jest.fn();
    renderWithStore(
      <StatusToggleButton caseId={42} currentStatus="Available" onToggled={onToggled} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /tandai dipinjam/i }));

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/archive/cases/42/status',
      { status: 'Borrowed' },
      'my-token',
    );
    expect(onToggled).toHaveBeenCalledWith('Borrowed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/StatusToggleButton.test.tsx`
Expected: FAIL — `Cannot find module './StatusToggleButton'`

- [ ] **Step 3: Write StatusToggleButton**

Create `src/components/StatusToggleButton.tsx`:

```typescript
'use client';

import { useSelector } from 'react-redux';
import { patch } from '@/lib/apiClient';
import type { RootState } from '@/store/store';

interface StatusToggleButtonProps {
  caseId: number;
  currentStatus: 'Available' | 'Borrowed';
  onToggled: (newStatus: 'Available' | 'Borrowed') => void;
}

export function StatusToggleButton({
  caseId,
  currentStatus,
  onToggled,
}: StatusToggleButtonProps) {
  const token = useSelector((state: RootState) => state.auth.token);
  const nextStatus = currentStatus === 'Available' ? 'Borrowed' : 'Available';
  const label = nextStatus === 'Borrowed' ? 'Tandai Dipinjam' : 'Tandai Tersedia';

  async function handleClick() {
    await patch(`/archive/cases/${caseId}/status`, { status: nextStatus }, token);
    onToggled(nextStatus);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded bg-white/20 px-4 py-2 font-semibold text-white"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/StatusToggleButton.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing ResultCard status-toggle integration test**

Add to `src/components/ResultCard.test.tsx`, replacing the file's imports and adding one new test:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { ResultCard } from './ResultCard';
import type { CaseResult } from '@/store/searchSlice';
import * as apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

const availableResult: CaseResult = {
  id: 1,
  case_number_raw: '45/Pid.B/2026/PN.Bks',
  case_type: 'Pid.B',
  year: 2026,
  parties_involved: 'Ahmad Subarjo',
  status: 'Available',
  location: { rack: 'Rak 4', row: 2, position: '05' },
  tts_payload: 'Arsip ditemukan.',
};

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token: 'my-token', role: 'petugas' as const } },
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('ResultCard', () => {
  it('renders the rack and position in giant text', () => {
    renderWithStore(<ResultCard result={availableResult} />);
    expect(screen.getByText('Rak 4')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('applies a green background when status is Available', () => {
    renderWithStore(<ResultCard result={availableResult} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-green-600');
  });

  it('applies a red background when status is Borrowed', () => {
    renderWithStore(<ResultCard result={{ ...availableResult, status: 'Borrowed' }} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-red-600');
  });

  it('shows a fallback message when location is null', () => {
    renderWithStore(<ResultCard result={{ ...availableResult, location: null }} />);
    expect(screen.getByText(/lokasi rak belum ditentukan/i)).toBeInTheDocument();
  });

  it('flips the background color after a successful status toggle', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({});
    renderWithStore(<ResultCard result={availableResult} />);

    await userEvent.click(screen.getByRole('button', { name: /tandai dipinjam/i }));

    expect(screen.getByTestId('result-card')).toHaveClass('bg-red-600');
  });
});
```

- [ ] **Step 6: Run the new test to verify it fails**

Run: `npx jest src/components/ResultCard.test.tsx`
Expected: FAIL — `StatusToggleButton` not rendered, no button found

- [ ] **Step 7: Wire StatusToggleButton into ResultCard with local status state**

Replace `src/components/ResultCard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { CaseResult } from '@/store/searchSlice';
import { StatusToggleButton } from './StatusToggleButton';

interface ResultCardProps {
  result: CaseResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const [status, setStatus] = useState(result.status);
  const bgClass = status === 'Available' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div
      data-testid="result-card"
      className={`${bgClass} text-white rounded-lg p-6 w-full max-w-xl flex flex-col gap-2`}
    >
      <p className="text-lg">
        Perkara {result.case_type} Nomor {result.case_number_raw} Tahun {result.year}
      </p>
      <p className="text-lg">{result.parties_involved}</p>
      {result.location ? (
        <>
          <p className="text-5xl md:text-6xl font-extrabold">{result.location.rack}</p>
          <p className="text-5xl md:text-6xl font-extrabold">
            {result.location.position ?? '-'}
          </p>
        </>
      ) : (
        <p className="text-2xl font-semibold">Lokasi rak belum ditentukan</p>
      )}
      <StatusToggleButton caseId={result.id} currentStatus={status} onToggled={setStatus} />
    </div>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/components/ResultCard.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 9: Run the full unit suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 10: Verify the app builds**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add court-archive-frontend/src/components/StatusToggleButton.tsx court-archive-frontend/src/components/StatusToggleButton.test.tsx court-archive-frontend/src/components/ResultCard.tsx court-archive-frontend/src/components/ResultCard.test.tsx
git commit -m "feat: add StatusToggleButton and wire status toggle into ResultCard"
```

---

## Plan Complete — What Exists Now

- A working Next.js frontend (`court-archive-frontend/`) with Redux Toolkit + `redux-persist` for auth state.
- Login page authenticating against the existing backend, JWT stored and persisted across refreshes.
- Protected `/search` route: mic-first voice search with automatic text-input fallback on unsupported browsers (PRD FR-7), posting to `POST /api/v1/archive/search`.
- Giant-text result display with Available (green) / Borrowed (red) status coloring (PRD FR-4.1–4.2).
- Automatic spoken TTS playback of the `tts_payload` on every search, with a stop/mute control (PRD FR-3.3).
- Status toggle button on each result card (PRD FR-4.3), calling the existing `PATCH /archive/cases/:id/status` endpoint.

**Not yet built (deferred to later plans):**
- **Plan 5:** Admin-only CRUD pages (case/shelf management), CSV/Excel import UI, role-based navigation hiding (PRD FR-5.2, FR-6).
- **Plan 6:** PWA manifest, installability service worker, icon assets (PRD NFR-5, TSD Section 7.1).
