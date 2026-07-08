# Backend Foundation (Plan 1 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `court-archive-backend` NestJS repo with Prisma/PostgreSQL, the `users`/`shelves`/`court_cases` schema, JWT authentication with Admin/Petugas role guards, and baseline OWASP hardening (input validation, bcrypt, rate limiting) — verified end-to-end with a real login and a role-gated request.

**Architecture:** A single NestJS application (`court-archive-backend` repo) with feature modules: `PrismaModule` (DB client), `AuthModule` (login, JWT strategy, role guard), and a shared `common/` folder for guards/decorators. Prisma owns schema + migrations against PostgreSQL. This plan produces no business-data endpoints yet (cases/shelves CRUD is Plan 2) — it ends with a working login endpoint and a demo protected route proving the role guard works, which later plans build on.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 15+, `@nestjs/jwt`, `@nestjs/passport` + `passport-jwt`, `bcrypt`, `@nestjs/throttler`, Jest (NestJS default).

## Global Constraints

- Language locale for all user-facing strings/voice content is `id-ID` (from PRD NFR-1) — not relevant to this plan's scope (no user-facing strings yet) but binds later plans.
- No anonymous access to any `/api/v1/*` route (TSD Section 6) — every route in this plan and beyond requires a valid JWT except `POST /api/v1/auth/login`.
- Passwords hashed with bcrypt, never logged or stored in plaintext (TSD Section 8, A02).
- All DB access via Prisma's parameterized query builder — no raw string-concatenated SQL (TSD Section 8, A03).
- `ValidationPipe` with `whitelist: true` applied globally so unexpected payload fields are stripped on every endpoint (TSD Section 8, A05).
- Verbose stack traces disabled outside development (`NODE_ENV=production`) (TSD Section 8, A05).
- Two roles only: `admin` and `petugas` (TSD `users.role` CHECK constraint) — no other role values anywhere in code.
- Repository is `court-archive-backend`, fully separate from the frontend repo, communicating only over HTTP (TSD Section 0).

---

## File Structure

```
court-archive-backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.controller.spec.ts
│   │   ├── dto/
│   │   │   └── login.dto.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       ├── roles.guard.ts
│   │       └── roles.guard.spec.ts
│   ├── common/
│   │   └── decorators/
│   │       └── roles.decorator.ts
│   └── demo/
│       ├── demo.module.ts
│       ├── demo.controller.ts
│       └── demo.controller.spec.ts
├── test/
│   └── app.e2e-spec.ts
├── .env.example
├── package.json
└── tsconfig.json
```

Each file's responsibility:
- `prisma/schema.prisma` — single source of truth for `users`, `shelves`, `court_cases` tables (TSD Section 3).
- `prisma.service.ts` / `prisma.module.ts` — injectable Prisma client, shared by every future feature module.
- `auth/*` — login endpoint, password verification, JWT issuance, JWT validation strategy, role guard. This is the only module in this plan with business logic.
- `common/decorators/roles.decorator.ts` — `@Roles('admin')` metadata decorator consumed by `RolesGuard`.
- `demo/*` — a throwaway protected endpoint (`GET /api/v1/demo/admin-only`) that exists solely to prove the guard chain works end-to-end. Plan 2 deletes this module once real Admin-only endpoints exist.

---

### Task 1: Scaffold NestJS project and install dependencies

**Files:**
- Create: entire `court-archive-backend/` project (via Nest CLI)
- Modify: `court-archive-backend/package.json` (add dependencies)
- Create: `court-archive-backend/.env.example`

**Interfaces:**
- Produces: a runnable NestJS app on port 3000 with global prefix `/api/v1`, consumed by every later task in this plan and by Plans 2-3.

- [ ] **Step 1: Scaffold the project**

```bash
npx @nestjs/cli new court-archive-backend --package-manager npm --skip-git
cd court-archive-backend
```

Expected: a working NestJS skeleton with `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts` and their `.spec.ts` files.

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt @nestjs/throttler @prisma/client class-validator class-transformer
npm install -D prisma @types/passport-jwt @types/bcrypt
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: creates `prisma/schema.prisma` and `.env` with a `DATABASE_URL` placeholder.

- [ ] **Step 4: Create `.env.example`**

```bash
# court-archive-backend/.env.example
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/court_archive?schema=public"
JWT_SECRET="replace-with-a-long-random-string-in-production"
JWT_EXPIRES_IN="1h"
NODE_ENV="development"
```

- [ ] **Step 5: Set the global API prefix**

Edit `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(3000);
}
bootstrap();
```

- [ ] **Step 6: Verify the app boots**

Run: `npm run start:dev`
Expected: console prints `Nest application successfully started`, no errors. Stop with Ctrl+C.

- [ ] **Step 7: Remove the default demo controller/service**

```bash
rm src/app.controller.ts src/app.controller.spec.ts src/app.service.ts
```

Edit `src/app.module.ts` to remove the now-broken imports:

```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold NestJS project with Prisma, JWT, and validation deps"
```

---

### Task 2: Define Prisma schema for users, shelves, court_cases

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma Client models `User`, `Shelf`, `CourtCase` with fields matching TSD Section 3 exactly (field names below are the contract every later task/plan uses).

- [ ] **Step 1: Write the schema**

Replace the datasource/generator boilerplate in `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  admin
  petugas
}

enum CaseStatus {
  Available
  Borrowed
}

model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String   @map("password_hash")
  role         Role
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("users")
}

model Shelf {
  id         Int         @id @default(autoincrement())
  rackName   String      @map("rack_name")
  rowNumber  Int         @map("row_number")
  slotNumber Int?        @map("slot_number")
  createdAt  DateTime    @default(now()) @map("created_at")
  cases      CourtCase[]

  @@map("shelves")
}

model CourtCase {
  id                 Int        @id @default(autoincrement())
  caseNumberRaw      String     @map("case_number_raw")
  caseNumberClean    String?    @map("case_number_clean")
  caseType           String     @map("case_type")
  year               Int
  partiesInvolved    String     @map("parties_involved")
  shelfId            Int?       @map("shelf_id")
  shelf              Shelf?     @relation(fields: [shelfId], references: [id])
  filePositionNumber String?    @map("file_position_number")
  status             CaseStatus @default(Available)
  createdAt          DateTime   @default(now()) @map("created_at")

  @@map("court_cases")
}
```

- [ ] **Step 2: Ensure a local PostgreSQL is reachable and create the database**

Run: `createdb court_archive` (or via `psql -c "CREATE DATABASE court_archive;"`)
Expected: no error. If PostgreSQL isn't installed locally, start one via Docker: `docker run --name court-archive-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=court_archive -p 5432:5432 -d postgres:15`.

- [ ] **Step 3: Update `.env` to match Step 2's credentials, then run the first migration**

Run: `npx prisma migrate dev --name init`
Expected: output ends with `Your database is now in sync with your schema.` and generates `prisma/migrations/<timestamp>_init/migration.sql` containing `CREATE TABLE "users"`, `CREATE TABLE "shelves"`, `CREATE TABLE "court_cases"`.

- [ ] **Step 4: Add the `pg_trgm` extension migration (needed by Plan 3, harmless now)**

```bash
npx prisma migrate dev --name add_pg_trgm --create-only
```

Edit the generated empty `migration.sql` file to contain:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cases_fuzzy ON court_cases USING gin (parties_involved gin_trgm_ops);
CREATE INDEX idx_cases_number_clean ON court_cases USING gin (case_number_clean gin_trgm_ops);
```

Run: `npx prisma migrate dev`
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 5: Generate the Prisma Client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema for users, shelves, court_cases with pg_trgm indexes"
```

---

### Task 3: PrismaService and PrismaModule

**Files:**
- Create: `src/prisma/prisma.service.ts`
- Create: `src/prisma/prisma.module.ts`
- Create: `src/prisma/prisma.service.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaClient` from `@prisma/client` (generated in Task 2).
- Produces: `PrismaService` (injectable, extends `PrismaClient`, connects on module init) exported by `PrismaModule` — every later module (`AuthModule`, and Plans 2-3's modules) imports `PrismaModule` to get DB access.

- [ ] **Step 1: Write the failing test**

Create `src/prisma/prisma.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('should be defined and expose the User model delegate', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = moduleRef.get(PrismaService);
    expect(service).toBeDefined();
    expect(service.user).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/prisma/prisma.service.spec.ts`
Expected: FAIL — `Cannot find module './prisma.service'`

- [ ] **Step 3: Write PrismaService**

Create `src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/prisma/prisma.service.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Create PrismaModule**

Create `src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 6: Wire PrismaModule into AppModule**

Edit `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 7: Commit**

```bash
git add src/prisma/ src/app.module.ts
git commit -m "feat: add global PrismaModule and PrismaService"
```

---

### Task 4: Roles decorator and RolesGuard

**Files:**
- Create: `src/common/decorators/roles.decorator.ts`
- Create: `src/auth/guards/roles.guard.ts`
- Create: `src/auth/guards/roles.guard.spec.ts`

**Interfaces:**
- Produces: `@Roles('admin', 'petugas')` decorator and `RolesGuard` (checks `request.user.role` set by `JwtAuthGuard` in Task 6 against the roles required by `@Roles`). Later plans use `@Roles('admin')` on Admin-only endpoints and `@Roles('admin', 'petugas')` on shared ones, per TSD Section 6.

- [ ] **Step 1: Write the failing test**

Create `src/auth/guards/roles.guard.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(userRole: string | undefined, requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
    }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const { guard, context } = makeContext('petugas', undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user role is in the required list', () => {
    const { guard, context } = makeContext('admin', ['admin', 'petugas']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when user role is not in the required list', () => {
    const { guard, context } = makeContext('petugas', ['admin']);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when there is no authenticated user', () => {
    const { guard, context } = makeContext(undefined, ['admin']);
    expect(guard.canActivate(context)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/guards/roles.guard.spec.ts`
Expected: FAIL — `Cannot find module './roles.guard'`

- [ ] **Step 3: Write the Roles decorator**

Create `src/common/decorators/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('admin' | 'petugas')[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: Write RolesGuard**

Create `src/auth/guards/roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/auth/guards/roles.guard.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/common/ src/auth/guards/roles.guard.ts src/auth/guards/roles.guard.spec.ts
git commit -m "feat: add Roles decorator and RolesGuard"
```

---

### Task 5: AuthService — password verification and JWT issuance

**Files:**
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.service.spec.ts`
- Create: `src/auth/dto/login.dto.ts`

**Interfaces:**
- Consumes: `PrismaService.user.findUnique({ where: { username } })` returning `{ id, username, passwordHash, role, createdAt } | null`.
- Produces: `AuthService.validateUser(username: string, password: string): Promise<{ id: number; username: string; role: string } | null>` and `AuthService.login(user: { id: number; username: string; role: string }): { token: string; role: string }` — consumed by `AuthController` in Task 6.

- [ ] **Step 1: Write the failing test**

Create `src/auth/auth.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        JwtService,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('validateUser', () => {
    it('returns the user without passwordHash when credentials are correct', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'clerk1',
        passwordHash,
        role: 'petugas',
        createdAt: new Date(),
      });

      const result = await service.validateUser('clerk1', 'correct-password');

      expect(result).toEqual({ id: 1, username: 'clerk1', role: 'petugas' });
    });

    it('returns null when the password is wrong', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'clerk1',
        passwordHash,
        role: 'petugas',
        createdAt: new Date(),
      });

      const result = await service.validateUser('clerk1', 'wrong-password');

      expect(result).toBeNull();
    });

    it('returns null when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('ghost', 'anything');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns a signed token and the user role', () => {
      const result = service.login({ id: 1, username: 'clerk1', role: 'petugas' });

      expect(result.role).toBe('petugas');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: Write the login DTO**

Create `src/auth/dto/login.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}
```

- [ ] **Step 4: Write AuthService**

Create `src/auth/auth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    return { id: user.id, username: user.username, role: user.role };
  }

  login(user: AuthenticatedUser): { token: string; role: string } {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      token: this.jwtService.sign(payload),
      role: user.role,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts src/auth/dto/
git commit -m "feat: add AuthService with bcrypt password verification and JWT issuance"
```

---

### Task 6: JWT strategy, JwtAuthGuard, AuthController, AuthModule

**Files:**
- Create: `src/auth/strategies/jwt.strategy.ts`
- Create: `src/auth/guards/jwt-auth.guard.ts`
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.controller.spec.ts`
- Create: `src/auth/auth.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `AuthService.validateUser`, `AuthService.login` from Task 5; `process.env.JWT_SECRET`, `process.env.JWT_EXPIRES_IN`.
- Produces: `POST /api/v1/auth/login` returning `{ token: string, role: 'admin' | 'petugas' }` (TSD Section 5); `JwtAuthGuard` + `JwtStrategy` that populate `request.user = { id, username, role }` for every guarded route in this and later plans.

- [ ] **Step 1: Write the failing test for the controller**

Create `src/auth/auth.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { validateUser: jest.Mock; login: jest.Mock };

  beforeEach(async () => {
    authService = { validateUser: jest.fn(), login: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('returns a token and role on valid credentials', async () => {
    authService.validateUser.mockResolvedValue({ id: 1, username: 'clerk1', role: 'petugas' });
    authService.login.mockReturnValue({ token: 'signed.jwt.token', role: 'petugas' });

    const result = await controller.login({ username: 'clerk1', password: 'correct' });

    expect(authService.validateUser).toHaveBeenCalledWith('clerk1', 'correct');
    expect(result).toEqual({ token: 'signed.jwt.token', role: 'petugas' });
  });

  it('throws UnauthorizedException on invalid credentials', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(controller.login({ username: 'clerk1', password: 'wrong' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: FAIL — `Cannot find module './auth.controller'`

- [ ] **Step 3: Write the JWT strategy**

Create `src/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
```

- [ ] **Step 4: Write JwtAuthGuard**

Create `src/auth/guards/jwt-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 5: Write AuthController**

Create `src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.authService.login(user);
  }
}
```

- [ ] **Step 6: Run controller test to verify it passes**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Write AuthModule**

Create `src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 8: Wire AuthModule into AppModule**

Edit `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 9: Run the full unit test suite**

Run: `npx jest`
Expected: all suites PASS (PrismaService, RolesGuard, AuthService, AuthController).

- [ ] **Step 10: Commit**

```bash
git add src/auth/ src/app.module.ts
git commit -m "feat: add JWT strategy, JwtAuthGuard, AuthController, and AuthModule"
```

---

### Task 7: Seed one admin and one petugas user for manual verification

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Produces: two rows in `users` (`admin1`/`admin123`, `petugas1`/`petugas123`) used by Task 9's manual end-to-end check and by Plan 2's manual checks.

- [ ] **Step 1: Write the seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const petugasHash = await bcrypt.hash('petugas123', 10);

  await prisma.user.upsert({
    where: { username: 'admin1' },
    update: {},
    create: { username: 'admin1', passwordHash: adminHash, role: 'admin' },
  });

  await prisma.user.upsert({
    where: { username: 'petugas1' },
    update: {},
    create: { username: 'petugas1', passwordHash: petugasHash, role: 'petugas' },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Register the seed command**

Edit `package.json`, add a top-level key (sibling to `"scripts"`):

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

- [ ] **Step 3: Install ts-node if missing**

Run: `npm install -D ts-node`

- [ ] **Step 4: Run the seed**

Run: `npx prisma db seed`
Expected: no errors, script exits 0.

- [ ] **Step 5: Verify the rows exist**

Run: `npx prisma studio` (opens a browser UI) or `psql court_archive -c "SELECT username, role FROM users;"`
Expected: two rows — `admin1 | admin`, `petugas1 | petugas`.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat: add Prisma seed script for admin and petugas demo users"
```

---

### Task 8: Rate limiting on the login endpoint (OWASP A07)

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/auth/auth.controller.ts`

**Interfaces:**
- Produces: `POST /api/v1/auth/login` rejects with `429 Too Many Requests` after 5 attempts within 60 seconds from the same client, per TSD Section 8 (A07).

- [ ] **Step 1: Install and wire ThrottlerModule globally**

Edit `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 2: Apply a stricter limit to the login route specifically**

Edit `src/auth/auth.controller.ts`, add the `Throttle` decorator:

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.authService.login(user);
  }
}
```

- [ ] **Step 3: Manually verify the rate limit**

Run: `npm run start:dev`, then in another terminal:

```bash
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin1","password":"wrong"}'; done
```

Expected: first 5 lines print `401` (wrong password, but under the limit), 6th line prints `429`.

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts src/auth/auth.controller.ts
git commit -m "feat: rate-limit the login endpoint to mitigate brute-force attempts"
```

---

### Task 9: Demo protected route proving the JWT + role guard chain works

**Files:**
- Create: `src/demo/demo.module.ts`
- Create: `src/demo/demo.controller.ts`
- Create: `src/demo/demo.controller.spec.ts`
- Modify: `src/app.module.ts`
- Create: `test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `RolesGuard`, `@Roles` decorator from Tasks 4 and 6.
- Produces: `GET /api/v1/demo/admin-only` (200 for `admin` role, 403 for `petugas`, 401 for no token) — a disposable proof that later plans' real endpoints can copy this guard pattern. Plan 2 deletes this module.

- [ ] **Step 1: Write the failing unit test**

Create `src/demo/demo.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DemoController } from './demo.controller';

describe('DemoController', () => {
  it('returns a confirmation message', () => {
    const controller = new DemoController();
    expect(controller.adminOnly()).toEqual({ message: 'You are an authenticated admin.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/demo/demo.controller.spec.ts`
Expected: FAIL — `Cannot find module './demo.controller'`

- [ ] **Step 3: Write DemoController**

Create `src/demo/demo.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  @Get('admin-only')
  @Roles('admin')
  adminOnly() {
    return { message: 'You are an authenticated admin.' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/demo/demo.controller.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write DemoModule and wire it into AppModule**

Create `src/demo/demo.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DemoController],
})
export class DemoModule {}
```

Edit `src/app.module.ts` to add `DemoModule` to `imports`.

- [ ] **Step 6: Write the e2e test covering all three guard outcomes**

Replace the contents of `test/app.e2e-spec.ts` with:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth + RolesGuard (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let petugasToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin1', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const petugasLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'petugas1', password: 'petugas123' });
    petugasToken = petugasLogin.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/demo/admin-only').expect(401);
  });

  it('rejects petugas role with 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/demo/admin-only')
      .set('Authorization', `Bearer ${petugasToken}`)
      .expect(403);
  });

  it('allows admin role with 200', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/demo/admin-only')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual({ message: 'You are an authenticated admin.' });
  });
});
```

- [ ] **Step 7: Run the e2e test**

Run: `npm run test:e2e`
Expected: PASS (3 tests). This requires the seeded users from Task 7 to exist in the database the test connects to — confirm `.env`'s `DATABASE_URL` points at that database before running.

- [ ] **Step 8: Commit**

```bash
git add src/demo/ src/app.module.ts test/app.e2e-spec.ts
git commit -m "feat: add demo protected route and e2e test proving JWT + role guard chain"
```

---

### Task 10: Global exception filter hides stack traces outside development (OWASP A05)

**Files:**
- Create: `src/common/filters/all-exceptions.filter.ts`
- Create: `src/common/filters/all-exceptions.filter.spec.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `AllExceptionsFilter` — every unhandled error returns `{ statusCode, message }` only; when `NODE_ENV !== 'development'`, internal (500) errors always return the generic message `"Internal server error"` regardless of the original error's content, so implementation details never leak to a client.

- [ ] **Step 1: Write the failing test**

Create `src/common/filters/all-exceptions.filter.spec.ts`:

```typescript
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/demo/admin-only' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('passes through the status and message for known HttpExceptions', () => {
    process.env.NODE_ENV = 'development';
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost();

    filter.catch(new HttpException('Invalid username or password', HttpStatus.UNAUTHORIZED), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ statusCode: 401, message: 'Invalid username or password' });
  });

  it('masks unknown errors with a generic message outside development', () => {
    process.env.NODE_ENV = 'production';
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost();

    filter.catch(new Error('Prisma: connection string malformed at column 14'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/common/filters/all-exceptions.filter.spec.ts`
Expected: FAIL — `Cannot find module './all-exceptions.filter'`

- [ ] **Step 3: Write AllExceptionsFilter**

Create `src/common/filters/all-exceptions.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const isDev = process.env.NODE_ENV === 'development';
    const message = isHttpException
      ? exception.getResponse()
      : isDev
        ? (exception as Error).message
        : 'Internal server error';

    response.status(status).json({ statusCode: status, message });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/common/filters/all-exceptions.filter.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the filter globally**

Edit `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000);
}
bootstrap();
```

- [ ] **Step 6: Run the full test suite one final time**

Run: `npx jest && npm run test:e2e`
Expected: all unit and e2e tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/common/filters/ src/main.ts
git commit -m "feat: add global exception filter that masks internal errors outside development"
```

---

## Plan Complete — What Exists Now

- A running NestJS app (`npm run start:dev`) with PostgreSQL via Prisma.
- `users`, `shelves`, `court_cases` tables migrated, `pg_trgm` extension and indexes ready for Plan 3.
- `POST /api/v1/auth/login` — working login, bcrypt-verified, JWT-issued, rate-limited.
- `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` — the exact pattern Plan 2's CRUD endpoints and Plan 3's search endpoint will apply.
- Global `ValidationPipe` (whitelist) and `AllExceptionsFilter` (no leaked stack traces) applied app-wide.
- Two seeded demo users for manual verification.

**Not yet built (deferred to later plans):** any `cases`/`shelves` CRUD, CSV import, voice search/parsing, `tts_payload`, and the entire frontend. The `demo` module is a placeholder Plan 2 will delete once real Admin-gated endpoints exist.
