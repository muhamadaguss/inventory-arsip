# CRUD Backend (Plan 2 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Admin-only CRUD for `shelves` and `court_cases`, a Petugas-accessible status toggle endpoint, and a CSV/Excel bulk import endpoint for initial data migration — building on Plan 1's auth/role-guard foundation. Delete the disposable `demo` module Plan 1 left behind, now that real Admin-gated endpoints exist to prove the pattern instead.

**Architecture:** Two new NestJS feature modules — `ShelvesModule` and `CasesModule` — following the exact same guard pattern the `demo` module proved in Plan 1 (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`). Both modules use `PrismaService` (already global from Plan 1) for persistence. Import parsing (CSV via `csv-parse`, Excel via `exceljs`) lives in a small standalone parser module consumed by `CasesController`'s import endpoint — kept separate from the controller so the parsing logic is unit-testable without HTTP.

**Tech Stack:** NestJS 11 (existing), Prisma 7 (existing), `csv-parse` (new), `exceljs` (new), `class-validator` (existing, for CRUD DTOs), Jest (existing).

## Global Constraints

- No anonymous access to any `/api/v1/*` route (TSD Section 6) — every endpoint in this plan requires a valid JWT via `JwtAuthGuard`.
- Two roles only: `admin` and `petugas` — no other role values anywhere in code.
- Admin-only: shelves CRUD, cases CRUD (create/update/delete), CSV/Excel import (PRD Section 7, TSD Section 5).
- Admin + Petugas: case status toggle only, via `PATCH /api/v1/archive/cases/:id/status`, restricted to the `status` field — no other case fields may be altered through this endpoint (PRD FR-4.3).
- `ValidationPipe` with `whitelist: true` is already applied globally (Plan 1) — every new DTO in this plan relies on it to strip unexpected fields (TSD Section 8, A05).
- All DB access via Prisma's parameterized query builder — no raw string-concatenated SQL (TSD Section 8, A03).
- Import validates every row against a schema before insert — no `eval`/dynamic deserialization of uploaded file content (TSD Section 8, A08). Rejected rows are reported back, never silently dropped or the whole batch aborted (PRD FR-6.2).
- `case_number_clean`, `shelf_id`, `file_position_number` are nullable per the Prisma schema (Plan 1, Task 2) — CRUD/import DTOs must treat them as optional, not required.
- Repository is a monorepo subfolder `court-archive-backend/` inside `inventory-arsip` — every commit in this plan is scoped to paths under `court-archive-backend/`.
- Two roles' worth of route protection must reuse `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`) and `RolesGuard` + `@Roles(...)` (`src/auth/guards/roles.guard.ts`, `src/common/decorators/roles.decorator.ts`) from Plan 1 — do not re-implement guard logic.

---

## File Structure

```
court-archive-backend/
├── src/
│   ├── shelves/
│   │   ├── shelves.module.ts
│   │   ├── shelves.controller.ts
│   │   ├── shelves.controller.spec.ts
│   │   ├── shelves.service.ts
│   │   ├── shelves.service.spec.ts
│   │   └── dto/
│   │       ├── create-shelf.dto.ts
│   │       └── update-shelf.dto.ts
│   ├── cases/
│   │   ├── cases.module.ts
│   │   ├── cases.controller.ts
│   │   ├── cases.controller.spec.ts
│   │   ├── cases.service.ts
│   │   ├── cases.service.spec.ts
│   │   ├── dto/
│   │   │   ├── create-case.dto.ts
│   │   │   ├── update-case.dto.ts
│   │   │   └── update-case-status.dto.ts
│   │   └── import/
│   │       ├── case-import.service.ts
│   │       ├── case-import.service.spec.ts
│   │       └── dto/
│   │           └── import-result.dto.ts
│   ├── app.module.ts (modified)
│   └── demo/ (deleted)
```

Each file's responsibility:
- `shelves.service.ts` — Prisma CRUD for `Shelf` (create, findAll, findOne, update, remove). No HTTP concerns.
- `shelves.controller.ts` — routes + guards + DTO validation, delegates to `ShelvesService`.
- `cases.service.ts` — Prisma CRUD for `CourtCase`, plus the narrow `updateStatus` method the Petugas-facing route uses.
- `cases.controller.ts` — routes + guards for cases CRUD, status toggle, and the import endpoint (delegates parsing to `CaseImportService`).
- `case-import.service.ts` — pure parsing + validation logic: takes a file buffer + mimetype, returns `{ importedCount, rejectedRows }`. No HTTP concerns, so it's testable with in-memory buffers instead of real file uploads.

---

### Task 1: Delete the disposable demo module

**Files:**
- Delete: `src/demo/demo.module.ts`
- Delete: `src/demo/demo.controller.ts`
- Delete: `src/demo/demo.controller.spec.ts`
- Modify: `src/app.module.ts`
- Modify: `test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: a clean `AppModule` with no `DemoModule` import, ready for `ShelvesModule`/`CasesModule` in later tasks. The e2e test that proved the guard chain (Plan 1, Task 9) is rewritten here to prove the same chain against a real endpoint from this plan instead of the disposable one — Task 6 below is where that real endpoint (`shelves` list) exists, so this task's e2e rewrite is deferred to Task 6's own e2e coverage. For now, this task only removes the demo files and confirms the app still boots and the existing auth e2e assertions (login success/failure) still pass with the demo-specific assertions removed.

- [ ] **Step 1: Remove the demo module files**

```bash
cd court-archive-backend
rm -rf src/demo
```

- [ ] **Step 2: Remove DemoModule from AppModule**

Edit `src/app.module.ts` — remove the `DemoModule` import and its entry in `imports`:

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

- [ ] **Step 3: Remove the demo-route assertions from the e2e test, keep the login assertions**

Replace the contents of `test/app.e2e-spec.ts` with:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in successfully with valid seeded credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin1', password: 'admin123' })
      .expect(200);

    expect(response.body.role).toBe('admin');
    expect(typeof response.body.token).toBe('string');
  });

  it('rejects invalid credentials with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin1', password: 'wrong-password' })
      .expect(401);
  });
});
```

- [ ] **Step 4: Run the unit and e2e suites to confirm nothing broke**

Run: `npx jest`
Expected: all remaining suites pass (the demo controller spec is gone, so its 1 test no longer runs).

Run: `npm run test:e2e`
Expected: PASS (2 tests) — login success and login failure, against the real seeded `admin1` user.

- [ ] **Step 5: Commit**

```bash
git add court-archive-backend/src/app.module.ts court-archive-backend/test/app.e2e-spec.ts
git rm -r court-archive-backend/src/demo
git commit -m "chore: remove disposable demo module now that real endpoints are coming"
```

---

### Task 2: ShelvesService — Prisma CRUD for Shelf

**Files:**
- Create: `src/shelves/shelves.service.ts`
- Create: `src/shelves/shelves.service.spec.ts`
- Create: `src/shelves/dto/create-shelf.dto.ts`
- Create: `src/shelves/dto/update-shelf.dto.ts`

**Interfaces:**
- Consumes: `PrismaService` (global, from Plan 1) — `prisma.shelf.create/findMany/findUnique/update/delete`.
- Produces: `ShelvesService.create(dto: CreateShelfDto): Promise<Shelf>`, `.findAll(): Promise<Shelf[]>`, `.findOne(id: number): Promise<Shelf>` (throws `NotFoundException` if missing), `.update(id: number, dto: UpdateShelfDto): Promise<Shelf>`, `.remove(id: number): Promise<void>` — consumed by `ShelvesController` in Task 3. `Shelf` here is Prisma's generated type: `{ id: number; rackName: string; rowNumber: number; slotNumber: number | null; createdAt: Date }`.

- [ ] **Step 1: Write the DTOs**

Create `src/shelves/dto/create-shelf.dto.ts`:

```typescript
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShelfDto {
  @IsString()
  @IsNotEmpty()
  rackName: string;

  @IsInt()
  rowNumber: number;

  @IsOptional()
  @IsInt()
  slotNumber?: number;
}
```

Create `src/shelves/dto/update-shelf.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateShelfDto } from './create-shelf.dto';

export class UpdateShelfDto extends PartialType(CreateShelfDto) {}
```

- [ ] **Step 2: Install `@nestjs/mapped-types` if not already present**

Run: `cd court-archive-backend && npm ls @nestjs/mapped-types`
If not found: `npm install @nestjs/mapped-types`

- [ ] **Step 3: Write the failing tests**

Create `src/shelves/shelves.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShelvesService } from './shelves.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ShelvesService', () => {
  let service: ShelvesService;
  let prisma: {
    shelf: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      shelf: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ShelvesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ShelvesService);
  });

  it('creates a shelf', async () => {
    const dto = { rackName: 'Rak A', rowNumber: 1 };
    const created = { id: 1, ...dto, slotNumber: null, createdAt: new Date() };
    prisma.shelf.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(prisma.shelf.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(created);
  });

  it('lists all shelves', async () => {
    const shelves = [{ id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() }];
    prisma.shelf.findMany.mockResolvedValue(shelves);

    const result = await service.findAll();

    expect(result).toEqual(shelves);
  });

  it('finds one shelf by id', async () => {
    const shelf = { id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() };
    prisma.shelf.findUnique.mockResolvedValue(shelf);

    const result = await service.findOne(1);

    expect(prisma.shelf.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(shelf);
  });

  it('throws NotFoundException when finding a missing shelf', async () => {
    prisma.shelf.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('updates a shelf', async () => {
    const dto = { rowNumber: 2 };
    const updated = { id: 1, rackName: 'Rak A', rowNumber: 2, slotNumber: null, createdAt: new Date() };
    prisma.shelf.update.mockResolvedValue(updated);

    const result = await service.update(1, dto);

    expect(prisma.shelf.update).toHaveBeenCalledWith({ where: { id: 1 }, data: dto });
    expect(result).toEqual(updated);
  });

  it('removes a shelf', async () => {
    prisma.shelf.delete.mockResolvedValue({ id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() });

    await service.remove(1);

    expect(prisma.shelf.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest src/shelves/shelves.service.spec.ts`
Expected: FAIL — `Cannot find module './shelves.service'`

- [ ] **Step 5: Write ShelvesService**

Create `src/shelves/shelves.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShelfDto } from './dto/create-shelf.dto';
import { UpdateShelfDto } from './dto/update-shelf.dto';

@Injectable()
export class ShelvesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateShelfDto) {
    return this.prisma.shelf.create({ data: dto });
  }

  findAll() {
    return this.prisma.shelf.findMany();
  }

  async findOne(id: number) {
    const shelf = await this.prisma.shelf.findUnique({ where: { id } });
    if (!shelf) {
      throw new NotFoundException(`Shelf ${id} not found`);
    }
    return shelf;
  }

  update(id: number, dto: UpdateShelfDto) {
    return this.prisma.shelf.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.shelf.delete({ where: { id } });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/shelves/shelves.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add court-archive-backend/src/shelves/ court-archive-backend/package.json court-archive-backend/package-lock.json
git commit -m "feat: add ShelvesService with Prisma CRUD for shelf records"
```

---

### Task 3: ShelvesController — Admin-only routes

**Files:**
- Create: `src/shelves/shelves.controller.ts`
- Create: `src/shelves/shelves.controller.spec.ts`
- Create: `src/shelves/shelves.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `ShelvesService` (Task 2), `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` (Plan 1).
- Produces: `POST /api/v1/archive/shelves`, `GET /api/v1/archive/shelves`, `GET /api/v1/archive/shelves/:id`, `PUT /api/v1/archive/shelves/:id`, `DELETE /api/v1/archive/shelves/:id` — all `@Roles('admin')` per TSD Section 5 ("Standard CRUD for individual case records and shelf layout... Access: Admin only").

- [ ] **Step 1: Write the failing controller test**

Create `src/shelves/shelves.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ShelvesController } from './shelves.controller';
import { ShelvesService } from './shelves.service';

describe('ShelvesController', () => {
  let controller: ShelvesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ShelvesController],
      providers: [{ provide: ShelvesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(ShelvesController);
  });

  it('creates a shelf via the service', async () => {
    const dto = { rackName: 'Rak A', rowNumber: 1 };
    service.create.mockResolvedValue({ id: 1, ...dto, slotNumber: null, createdAt: new Date() });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.rackName).toBe('Rak A');
  });

  it('lists shelves via the service', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it('finds one shelf via the service', async () => {
    service.findOne.mockResolvedValue({ id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() });

    const result = await controller.findOne(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('updates a shelf via the service', async () => {
    const dto = { rowNumber: 2 };
    service.update.mockResolvedValue({ id: 1, rackName: 'Rak A', rowNumber: 2, slotNumber: null, createdAt: new Date() });

    const result = await controller.update(1, dto);

    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(result.rowNumber).toBe(2);
  });

  it('removes a shelf via the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(1);

    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/shelves/shelves.controller.spec.ts`
Expected: FAIL — `Cannot find module './shelves.controller'`

- [ ] **Step 3: Write ShelvesController**

Create `src/shelves/shelves.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ShelvesService } from './shelves.service';
import { CreateShelfDto } from './dto/create-shelf.dto';
import { UpdateShelfDto } from './dto/update-shelf.dto';

@Controller('archive/shelves')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ShelvesController {
  constructor(private shelvesService: ShelvesService) {}

  @Post()
  create(@Body() dto: CreateShelfDto) {
    return this.shelvesService.create(dto);
  }

  @Get()
  findAll() {
    return this.shelvesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.shelvesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateShelfDto) {
    return this.shelvesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.shelvesService.remove(id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/shelves/shelves.controller.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write ShelvesModule and wire it into AppModule**

Create `src/shelves/shelves.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ShelvesController } from './shelves.controller';
import { ShelvesService } from './shelves.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ShelvesController],
  providers: [ShelvesService],
  exports: [ShelvesService],
})
export class ShelvesModule {}
```

Edit `src/app.module.ts` to add `ShelvesModule`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ShelvesModule } from './shelves/shelves.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    ShelvesModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 6: Run the full unit suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add court-archive-backend/src/shelves/ court-archive-backend/src/app.module.ts
git commit -m "feat: add Admin-only ShelvesController with CRUD routes"
```

---

### Task 4: CasesService — Prisma CRUD for CourtCase (excluding status toggle)

**Files:**
- Create: `src/cases/cases.service.ts`
- Create: `src/cases/cases.service.spec.ts`
- Create: `src/cases/dto/create-case.dto.ts`
- Create: `src/cases/dto/update-case.dto.ts`

**Interfaces:**
- Consumes: `PrismaService` — `prisma.courtCase.create/findMany/findUnique/update/delete`.
- Produces: `CasesService.create(dto: CreateCaseDto): Promise<CourtCase>`, `.findAll(): Promise<CourtCase[]>`, `.findOne(id: number): Promise<CourtCase>` (throws `NotFoundException`), `.update(id: number, dto: UpdateCaseDto): Promise<CourtCase>`, `.remove(id: number): Promise<void>` — consumed by `CasesController` (Task 5). Status-only updates are a separate method added in Task 6 (`updateStatus`), kept out of this general `update` to enforce the PRD constraint that the status-toggle route can only touch `status`.

- [ ] **Step 1: Write the DTOs**

Create `src/cases/dto/create-case.dto.ts`:

```typescript
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty()
  caseNumberRaw: string;

  @IsOptional()
  @IsString()
  caseNumberClean?: string;

  @IsString()
  @IsNotEmpty()
  caseType: string;

  @IsInt()
  year: number;

  @IsString()
  @IsNotEmpty()
  partiesInvolved: string;

  @IsOptional()
  @IsInt()
  shelfId?: number;

  @IsOptional()
  @IsString()
  filePositionNumber?: string;
}
```

Create `src/cases/dto/update-case.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCaseDto } from './create-case.dto';

export class UpdateCaseDto extends PartialType(CreateCaseDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `src/cases/cases.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CasesService', () => {
  let service: CasesService;
  let prisma: {
    courtCase: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const sampleCase = {
    id: 1,
    caseNumberRaw: '120/Pdt.G/2026/PN.Bks',
    caseNumberClean: '120 Pdt G 2026',
    caseType: 'Pdt.G',
    year: 2026,
    partiesInvolved: 'Ahmad Subarjo',
    shelfId: null,
    filePositionNumber: null,
    status: 'Available',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      courtCase: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CasesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CasesService);
  });

  it('creates a case', async () => {
    const dto = {
      caseNumberRaw: sampleCase.caseNumberRaw,
      caseType: sampleCase.caseType,
      year: sampleCase.year,
      partiesInvolved: sampleCase.partiesInvolved,
    };
    prisma.courtCase.create.mockResolvedValue(sampleCase);

    const result = await service.create(dto);

    expect(prisma.courtCase.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(sampleCase);
  });

  it('lists all cases', async () => {
    prisma.courtCase.findMany.mockResolvedValue([sampleCase]);

    const result = await service.findAll();

    expect(result).toEqual([sampleCase]);
  });

  it('finds one case by id', async () => {
    prisma.courtCase.findUnique.mockResolvedValue(sampleCase);

    const result = await service.findOne(1);

    expect(prisma.courtCase.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(sampleCase);
  });

  it('throws NotFoundException when finding a missing case', async () => {
    prisma.courtCase.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('updates a case', async () => {
    const dto = { partiesInvolved: 'Ahmad Subarjo bin Slamet' };
    const updated = { ...sampleCase, ...dto };
    prisma.courtCase.update.mockResolvedValue(updated);

    const result = await service.update(1, dto);

    expect(prisma.courtCase.update).toHaveBeenCalledWith({ where: { id: 1 }, data: dto });
    expect(result).toEqual(updated);
  });

  it('removes a case', async () => {
    prisma.courtCase.delete.mockResolvedValue(sampleCase);

    await service.remove(1);

    expect(prisma.courtCase.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/cases/cases.service.spec.ts`
Expected: FAIL — `Cannot find module './cases.service'`

- [ ] **Step 4: Write CasesService**

Create `src/cases/cases.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Injectable()
export class CasesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCaseDto) {
    return this.prisma.courtCase.create({ data: dto });
  }

  findAll() {
    return this.prisma.courtCase.findMany();
  }

  async findOne(id: number) {
    const courtCase = await this.prisma.courtCase.findUnique({ where: { id } });
    if (!courtCase) {
      throw new NotFoundException(`Case ${id} not found`);
    }
    return courtCase;
  }

  update(id: number, dto: UpdateCaseDto) {
    return this.prisma.courtCase.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.courtCase.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/cases/cases.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add court-archive-backend/src/cases/cases.service.ts court-archive-backend/src/cases/cases.service.spec.ts court-archive-backend/src/cases/dto/create-case.dto.ts court-archive-backend/src/cases/dto/update-case.dto.ts
git commit -m "feat: add CasesService with Prisma CRUD for court case records"
```

---

### Task 5: CasesController — Admin-only CRUD routes

**Files:**
- Create: `src/cases/cases.controller.ts`
- Create: `src/cases/cases.controller.spec.ts`
- Create: `src/cases/cases.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `CasesService` (Task 4), `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` (Plan 1).
- Produces: `POST /api/v1/archive/cases`, `GET /api/v1/archive/cases`, `GET /api/v1/archive/cases/:id`, `PUT /api/v1/archive/cases/:id`, `DELETE /api/v1/archive/cases/:id` — all `@Roles('admin')` per TSD Section 5. The status-toggle route (`PATCH .../cases/:id/status`, both roles) is added in Task 6 on the same controller.

- [ ] **Step 1: Write the failing controller test**

Create `src/cases/cases.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

describe('CasesController', () => {
  let controller: CasesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [{ provide: CasesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(CasesController);
  });

  it('creates a case via the service', async () => {
    const dto = { caseNumberRaw: '120/Pdt.G/2026', caseType: 'Pdt.G', year: 2026, partiesInvolved: 'Ahmad' };
    service.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.id).toBe(1);
  });

  it('lists cases via the service', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it('finds one case via the service', async () => {
    service.findOne.mockResolvedValue({ id: 1, caseNumberRaw: '120/Pdt.G/2026' });

    const result = await controller.findOne(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('updates a case via the service', async () => {
    const dto = { partiesInvolved: 'Ahmad Subarjo bin Slamet' };
    service.update.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.update(1, dto);

    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(result.partiesInvolved).toBe('Ahmad Subarjo bin Slamet');
  });

  it('removes a case via the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(1);

    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/cases/cases.controller.spec.ts`
Expected: FAIL — `Cannot find module './cases.controller'`

- [ ] **Step 3: Write CasesController (CRUD routes only — status route added in Task 6)**

Create `src/cases/cases.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Controller('archive/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Get()
  @Roles('admin', 'petugas')
  findAll() {
    return this.casesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'petugas')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.casesService.remove(id);
  }
}
```

Note: `findAll`/`findOne` are readable by both roles (Petugas needs to search/view cases per PRD — write operations stay Admin-only), matching TSD's Admin-only framing for mutation while Section 4.3's search flow implies Petugas can read case data.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/cases/cases.controller.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write CasesModule and wire it into AppModule**

Create `src/cases/cases.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
```

Edit `src/app.module.ts` to add `CasesModule`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ShelvesModule } from './shelves/shelves.module';
import { CasesModule } from './cases/cases.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    ShelvesModule,
    CasesModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 6: Run the full unit suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add court-archive-backend/src/cases/cases.controller.ts court-archive-backend/src/cases/cases.controller.spec.ts court-archive-backend/src/cases/cases.module.ts court-archive-backend/src/app.module.ts
git commit -m "feat: add CasesController with Admin CRUD and Petugas read access"
```

---

### Task 6: Case status toggle — Admin + Petugas, status field only

**Files:**
- Create: `src/cases/dto/update-case-status.dto.ts`
- Modify: `src/cases/cases.service.ts`
- Modify: `src/cases/cases.service.spec.ts`
- Modify: `src/cases/cases.controller.ts`
- Modify: `src/cases/cases.controller.spec.ts`
- Create: `test/cases.e2e-spec.ts`

**Interfaces:**
- Consumes: `CasesService` (Task 4/5).
- Produces: `PATCH /api/v1/archive/cases/:id/status` (`@Roles('admin', 'petugas')`), body `{ status: 'Available' | 'Borrowed' }`, calling a new `CasesService.updateStatus(id: number, status: 'Available' | 'Borrowed'): Promise<CourtCase>` method — this method touches only the `status` column, enforcing PRD FR-4.3's constraint that this route cannot be used to smuggle in other field edits (TSD Section 8, A01).

- [ ] **Step 1: Write the status DTO**

Create `src/cases/dto/update-case-status.dto.ts`:

```typescript
import { IsIn } from 'class-validator';

export class UpdateCaseStatusDto {
  @IsIn(['Available', 'Borrowed'])
  status: 'Available' | 'Borrowed';
}
```

- [ ] **Step 2: Write the failing service test for `updateStatus`**

Add to `src/cases/cases.service.spec.ts`, inside the existing `describe('CasesService', ...)` block, after the `'removes a case'` test:

```typescript
  it('updates only the status field', async () => {
    const updated = { ...sampleCase, status: 'Borrowed' };
    prisma.courtCase.update.mockResolvedValue(updated);

    const result = await service.updateStatus(1, 'Borrowed');

    expect(prisma.courtCase.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'Borrowed' },
    });
    expect(result.status).toBe('Borrowed');
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/cases/cases.service.spec.ts`
Expected: FAIL — `service.updateStatus is not a function`

- [ ] **Step 4: Add `updateStatus` to CasesService**

Edit `src/cases/cases.service.ts`, add this method inside the `CasesService` class, after `update`:

```typescript
  updateStatus(id: number, status: 'Available' | 'Borrowed') {
    return this.prisma.courtCase.update({ where: { id }, data: { status } });
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/cases/cases.service.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Write the failing controller test for the status route**

Add to `src/cases/cases.controller.spec.ts`, inside the existing `describe('CasesController', ...)` block: first add `updateStatus: jest.Mock` to the `service` object's type and its `beforeEach` initialization (`updateStatus: jest.fn(),`), then add this test after the `'removes a case'` test:

```typescript
  it('updates case status via the service', async () => {
    service.updateStatus.mockResolvedValue({ id: 1, status: 'Borrowed' });

    const result = await controller.updateStatus(1, { status: 'Borrowed' });

    expect(service.updateStatus).toHaveBeenCalledWith(1, 'Borrowed');
    expect(result.status).toBe('Borrowed');
  });
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx jest src/cases/cases.controller.spec.ts`
Expected: FAIL — `controller.updateStatus is not a function`

- [ ] **Step 8: Add the status route to CasesController**

Edit `src/cases/cases.controller.ts` — add the import and the new method. Full updated file:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

@Controller('archive/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Get()
  @Roles('admin', 'petugas')
  findAll() {
    return this.casesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'petugas')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'petugas')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseStatusDto) {
    return this.casesService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.casesService.remove(id);
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx jest src/cases/cases.controller.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 10: Write an e2e test proving both roles can toggle status, and that a Petugas request with extra fields doesn't leak into the update**

Create `test/cases.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cases status toggle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let petugasToken: string;
  let caseId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin1', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const petugasLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'petugas1', password: 'petugas123' });
    petugasToken = petugasLogin.body.token;

    const created = await prisma.courtCase.create({
      data: {
        caseNumberRaw: '999/Pdt.G/2026/PN.Test',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'E2E Test Party',
      },
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.courtCase.delete({ where: { id: caseId } });
    await app.close();
  });

  it('allows petugas to toggle status to Borrowed', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/archive/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ status: 'Borrowed' })
      .expect(200);

    expect(response.body.status).toBe('Borrowed');
  });

  it('allows admin to toggle status back to Available', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/archive/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Available' })
      .expect(200);

    expect(response.body.status).toBe('Available');
  });

  it('strips unexpected fields from the status update body', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/archive/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ status: 'Borrowed', partiesInvolved: 'Smuggled Name Change' })
      .expect(200);

    expect(response.body.status).toBe('Borrowed');
    expect(response.body.partiesInvolved).toBe('E2E Test Party');
  });

  it('rejects an invalid status value with 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/archive/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NotARealStatus' })
      .expect(400);
  });
});
```

- [ ] **Step 11: Run the e2e test**

Run: `npm run test:e2e`
Expected: PASS — all scenarios in `cases.e2e-spec.ts` plus the existing `app.e2e-spec.ts` tests (5 tests total across both files).

- [ ] **Step 12: Commit**

```bash
git add court-archive-backend/src/cases/ court-archive-backend/test/cases.e2e-spec.ts
git commit -m "feat: add case status toggle endpoint for Admin and Petugas roles"
```

---

### Task 7: CaseImportService — CSV parsing and validation

**Files:**
- Create: `src/cases/import/case-import.service.ts`
- Create: `src/cases/import/case-import.service.spec.ts`
- Create: `src/cases/import/dto/import-result.dto.ts`

**Interfaces:**
- Consumes: `PrismaService` (`prisma.shelf.findFirst`, `prisma.courtCase.create`), `csv-parse/sync`.
- Produces: `CaseImportService.importFromCsv(buffer: Buffer): Promise<ImportResult>` where `ImportResult = { importedCount: number; rejectedRows: Array<{ row: number; reason: string }> }` — consumed by `CasesController`'s import endpoint (Task 9). Excel support is added in Task 8 as a second method (`importFromExcel`) on the same service, sharing the row-validation logic this task establishes.

- [ ] **Step 1: Install `csv-parse`**

Run: `cd court-archive-backend && npm install csv-parse`

- [ ] **Step 2: Write the ImportResult type**

Create `src/cases/import/dto/import-result.dto.ts`:

```typescript
export interface RejectedRow {
  row: number;
  reason: string;
}

export interface ImportResult {
  importedCount: number;
  rejectedRows: RejectedRow[];
}
```

- [ ] **Step 3: Write the failing tests**

Create `src/cases/import/case-import.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CaseImportService } from './case-import.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CaseImportService', () => {
  let service: CaseImportService;
  let prisma: {
    shelf: { findFirst: jest.Mock };
    courtCase: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      shelf: { findFirst: jest.fn() },
      courtCase: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CaseImportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CaseImportService);
  });

  const header = 'case_number_raw,case_type,year,parties_involved,rack_name,row_number,file_position_number\n';

  it('imports a valid row and resolves its shelf by rack_name + row_number', async () => {
    const csv = header + '120/Pdt.G/2026/PN.Bks,Pdt.G,2026,Ahmad Subarjo,Rak A,1,No. 05\n';
    prisma.shelf.findFirst.mockResolvedValue({ id: 7, rackName: 'Rak A', rowNumber: 1 });
    prisma.courtCase.create.mockResolvedValue({ id: 1 });

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.shelf.findFirst).toHaveBeenCalledWith({ where: { rackName: 'Rak A', rowNumber: 1 } });
    expect(prisma.courtCase.create).toHaveBeenCalledWith({
      data: {
        caseNumberRaw: '120/Pdt.G/2026/PN.Bks',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'Ahmad Subarjo',
        shelfId: 7,
        filePositionNumber: 'No. 05',
      },
    });
    expect(result).toEqual({ importedCount: 1, rejectedRows: [] });
  });

  it('imports a row with no shelf reference as shelfId null', async () => {
    const csv = header + '121/Pdt.G/2026/PN.Bks,Pdt.G,2026,Budi Santoso,,,\n';
    prisma.courtCase.create.mockResolvedValue({ id: 2 });

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.shelf.findFirst).not.toHaveBeenCalled();
    expect(prisma.courtCase.create).toHaveBeenCalledWith({
      data: {
        caseNumberRaw: '121/Pdt.G/2026/PN.Bks',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'Budi Santoso',
        shelfId: null,
        filePositionNumber: null,
      },
    });
    expect(result).toEqual({ importedCount: 1, rejectedRows: [] });
  });

  it('rejects a row missing case_number_raw', async () => {
    const csv = header + ',Pdt.G,2026,Budi Santoso,,,\n';

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.courtCase.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      importedCount: 0,
      rejectedRows: [{ row: 1, reason: 'Missing case_number_raw' }],
    });
  });

  it('rejects a row with an unresolvable shelf reference', async () => {
    const csv = header + '122/Pdt.G/2026/PN.Bks,Pdt.G,2026,Citra Dewi,Rak Z,9,\n';
    prisma.shelf.findFirst.mockResolvedValue(null);

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.courtCase.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      importedCount: 0,
      rejectedRows: [{ row: 1, reason: "Unresolvable shelf reference 'Rak Z' row 9" }],
    });
  });

  it('continues importing remaining rows after a rejected row', async () => {
    const csv =
      header +
      ',Pdt.G,2026,Missing Number,,,\n' +
      '123/Pdt.G/2026/PN.Bks,Pdt.G,2026,Valid Row,,,\n';
    prisma.courtCase.create.mockResolvedValue({ id: 3 });

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.courtCase.create).toHaveBeenCalledTimes(1);
    expect(result.importedCount).toBe(1);
    expect(result.rejectedRows).toEqual([{ row: 1, reason: 'Missing case_number_raw' }]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest src/cases/import/case-import.service.spec.ts`
Expected: FAIL — `Cannot find module './case-import.service'`

- [ ] **Step 5: Write CaseImportService**

Create `src/cases/import/case-import.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportResult, RejectedRow } from './dto/import-result.dto';

interface ParsedRow {
  case_number_raw?: string;
  case_type?: string;
  year?: string;
  parties_involved?: string;
  rack_name?: string;
  row_number?: string;
  file_position_number?: string;
}

@Injectable()
export class CaseImportService {
  constructor(private prisma: PrismaService) {}

  async importFromCsv(buffer: Buffer): Promise<ImportResult> {
    const rows: ParsedRow[] = parse(buffer, { columns: true, skip_empty_lines: true });
    return this.importRows(rows);
  }

  private async importRows(rows: ParsedRow[]): Promise<ImportResult> {
    let importedCount = 0;
    const rejectedRows: RejectedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const row = rows[i];

      if (!row.case_number_raw?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing case_number_raw' });
        continue;
      }
      if (!row.case_type?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing case_type' });
        continue;
      }
      if (!row.year?.trim() || Number.isNaN(Number(row.year))) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing or invalid year' });
        continue;
      }
      if (!row.parties_involved?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing parties_involved' });
        continue;
      }

      let shelfId: number | null = null;
      const rackName = row.rack_name?.trim();
      const rowNumberField = row.row_number?.trim();

      if (rackName || rowNumberField) {
        if (!rackName || !rowNumberField || Number.isNaN(Number(rowNumberField))) {
          rejectedRows.push({ row: rowNumber, reason: 'Incomplete shelf reference (need both rack_name and row_number)' });
          continue;
        }
        const shelf = await this.prisma.shelf.findFirst({
          where: { rackName, rowNumber: Number(rowNumberField) },
        });
        if (!shelf) {
          rejectedRows.push({
            row: rowNumber,
            reason: `Unresolvable shelf reference '${rackName}' row ${rowNumberField}`,
          });
          continue;
        }
        shelfId = shelf.id;
      }

      await this.prisma.courtCase.create({
        data: {
          caseNumberRaw: row.case_number_raw.trim(),
          caseType: row.case_type.trim(),
          year: Number(row.year),
          partiesInvolved: row.parties_involved.trim(),
          shelfId,
          filePositionNumber: row.file_position_number?.trim() || null,
        },
      });
      importedCount++;
    }

    return { importedCount, rejectedRows };
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/cases/import/case-import.service.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add court-archive-backend/src/cases/import/ court-archive-backend/package.json court-archive-backend/package-lock.json
git commit -m "feat: add CSV parsing and row validation for case import"
```

---

### Task 8: Excel import support on CaseImportService

**Files:**
- Modify: `src/cases/import/case-import.service.ts`
- Modify: `src/cases/import/case-import.service.spec.ts`

**Interfaces:**
- Consumes: `exceljs`.
- Produces: `CaseImportService.importFromExcel(buffer: Buffer): Promise<ImportResult>` — reads the first worksheet, treats row 1 as headers matching the same column names as the CSV path (`case_number_raw`, `case_type`, `year`, `parties_involved`, `rack_name`, `row_number`, `file_position_number`), converts to the same `ParsedRow[]` shape, and delegates to the same private `importRows` validation logic Task 7 built — so the validation rules never diverge between formats.

- [ ] **Step 1: Install `exceljs`**

Run: `cd court-archive-backend && npm install exceljs`

- [ ] **Step 2: Write the failing test**

Add to `src/cases/import/case-import.service.spec.ts`, after the existing tests inside the `describe('CaseImportService', ...)` block:

```typescript
  describe('importFromExcel', () => {
    it('imports a valid row from an .xlsx buffer', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Cases');
      sheet.addRow(['case_number_raw', 'case_type', 'year', 'parties_involved', 'rack_name', 'row_number', 'file_position_number']);
      sheet.addRow(['130/Pdt.G/2026/PN.Bks', 'Pdt.G', 2026, 'Dewi Lestari', 'Rak B', 2, 'No. 10']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      prisma.shelf.findFirst.mockResolvedValue({ id: 3, rackName: 'Rak B', rowNumber: 2 });
      prisma.courtCase.create.mockResolvedValue({ id: 4 });

      const result = await service.importFromExcel(buffer);

      expect(prisma.shelf.findFirst).toHaveBeenCalledWith({ where: { rackName: 'Rak B', rowNumber: 2 } });
      expect(prisma.courtCase.create).toHaveBeenCalledWith({
        data: {
          caseNumberRaw: '130/Pdt.G/2026/PN.Bks',
          caseType: 'Pdt.G',
          year: 2026,
          partiesInvolved: 'Dewi Lestari',
          shelfId: 3,
          filePositionNumber: 'No. 10',
        },
      });
      expect(result).toEqual({ importedCount: 1, rejectedRows: [] });
    });

    it('rejects a row missing case_number_raw from an .xlsx buffer', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Cases');
      sheet.addRow(['case_number_raw', 'case_type', 'year', 'parties_involved', 'rack_name', 'row_number', 'file_position_number']);
      sheet.addRow(['', 'Pdt.G', 2026, 'Missing Number', '', '', '']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const result = await service.importFromExcel(buffer);

      expect(prisma.courtCase.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        importedCount: 0,
        rejectedRows: [{ row: 1, reason: 'Missing case_number_raw' }],
      });
    });
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/cases/import/case-import.service.spec.ts`
Expected: FAIL — `service.importFromExcel is not a function`

- [ ] **Step 4: Add `importFromExcel` to CaseImportService**

Edit `src/cases/import/case-import.service.ts` — add the import and the new method. Full updated file:

```typescript
import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportResult, RejectedRow } from './dto/import-result.dto';

interface ParsedRow {
  case_number_raw?: string;
  case_type?: string;
  year?: string;
  parties_involved?: string;
  rack_name?: string;
  row_number?: string;
  file_position_number?: string;
}

const EXCEL_COLUMNS = [
  'case_number_raw',
  'case_type',
  'year',
  'parties_involved',
  'rack_name',
  'row_number',
  'file_position_number',
] as const;

@Injectable()
export class CaseImportService {
  constructor(private prisma: PrismaService) {}

  async importFromCsv(buffer: Buffer): Promise<ImportResult> {
    const rows: ParsedRow[] = parse(buffer, { columns: true, skip_empty_lines: true });
    return this.importRows(rows);
  }

  async importFromExcel(buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    const rows: ParsedRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const parsed: ParsedRow = {};
      EXCEL_COLUMNS.forEach((column, index) => {
        const cellValue = row.getCell(index + 1).value;
        parsed[column] = cellValue === null || cellValue === undefined ? undefined : String(cellValue);
      });
      rows.push(parsed);
    });

    return this.importRows(rows);
  }

  private async importRows(rows: ParsedRow[]): Promise<ImportResult> {
    let importedCount = 0;
    const rejectedRows: RejectedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const row = rows[i];

      if (!row.case_number_raw?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing case_number_raw' });
        continue;
      }
      if (!row.case_type?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing case_type' });
        continue;
      }
      if (!row.year?.trim() || Number.isNaN(Number(row.year))) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing or invalid year' });
        continue;
      }
      if (!row.parties_involved?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing parties_involved' });
        continue;
      }

      let shelfId: number | null = null;
      const rackName = row.rack_name?.trim();
      const rowNumberField = row.row_number?.trim();

      if (rackName || rowNumberField) {
        if (!rackName || !rowNumberField || Number.isNaN(Number(rowNumberField))) {
          rejectedRows.push({ row: rowNumber, reason: 'Incomplete shelf reference (need both rack_name and row_number)' });
          continue;
        }
        const shelf = await this.prisma.shelf.findFirst({
          where: { rackName, rowNumber: Number(rowNumberField) },
        });
        if (!shelf) {
          rejectedRows.push({
            row: rowNumber,
            reason: `Unresolvable shelf reference '${rackName}' row ${rowNumberField}`,
          });
          continue;
        }
        shelfId = shelf.id;
      }

      await this.prisma.courtCase.create({
        data: {
          caseNumberRaw: row.case_number_raw.trim(),
          caseType: row.case_type.trim(),
          year: Number(row.year),
          partiesInvolved: row.parties_involved.trim(),
          shelfId,
          filePositionNumber: row.file_position_number?.trim() || null,
        },
      });
      importedCount++;
    }

    return { importedCount, rejectedRows };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/cases/import/case-import.service.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add court-archive-backend/src/cases/import/ court-archive-backend/package.json court-archive-backend/package-lock.json
git commit -m "feat: add Excel import support sharing CSV's row validation logic"
```

---

### Task 9: Import endpoint on CasesController — Admin-only file upload

**Files:**
- Modify: `src/cases/cases.controller.ts`
- Modify: `src/cases/cases.controller.spec.ts`
- Modify: `src/cases/cases.module.ts`
- Create: `test/cases-import.e2e-spec.ts`

**Interfaces:**
- Consumes: `CaseImportService` (Task 7/8), `@nestjs/platform-express`'s `FileInterceptor`.
- Produces: `POST /api/v1/archive/cases/import` (`@Roles('admin')`), multipart file upload, dispatches to `importFromCsv` or `importFromExcel` based on the uploaded file's mimetype, returns `ImportResult` shaped as TSD Section 5's response (`{ status: 'partial_success' | 'success', imported_count, rejected_rows }`).

- [ ] **Step 1: Write the failing controller test**

Add to `src/cases/cases.controller.spec.ts` — first add `import: { importFromCsv: jest.Mock; importFromExcel: jest.Mock }` as a second provider mock in `beforeEach`, then add this test after the existing tests, inside the `describe('CasesController', ...)` block:

```typescript
  describe('import', () => {
    let importService: { importFromCsv: jest.Mock; importFromExcel: jest.Mock };

    beforeEach(async () => {
      importService = { importFromCsv: jest.fn(), importFromExcel: jest.fn() };

      const moduleRef = await Test.createTestingModule({
        controllers: [CasesController],
        providers: [
          { provide: CasesService, useValue: service },
          { provide: CaseImportService, useValue: importService },
        ],
      }).compile();

      controller = moduleRef.get(CasesController);
    });

    it('dispatches a .csv upload to importFromCsv', async () => {
      importService.importFromCsv.mockResolvedValue({ importedCount: 2, rejectedRows: [] });
      const file = { originalname: 'cases.csv', mimetype: 'text/csv', buffer: Buffer.from('data') } as Express.Multer.File;

      const result = await controller.importCases(file);

      expect(importService.importFromCsv).toHaveBeenCalledWith(file.buffer);
      expect(result).toEqual({ status: 'success', imported_count: 2, rejected_rows: [] });
    });

    it('dispatches an .xlsx upload to importFromExcel', async () => {
      importService.importFromExcel.mockResolvedValue({
        importedCount: 1,
        rejectedRows: [{ row: 2, reason: 'Missing case_number_raw' }],
      });
      const file = {
        originalname: 'cases.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('data'),
      } as Express.Multer.File;

      const result = await controller.importCases(file);

      expect(importService.importFromExcel).toHaveBeenCalledWith(file.buffer);
      expect(result).toEqual({
        status: 'partial_success',
        imported_count: 1,
        rejected_rows: [{ row: 2, reason: 'Missing case_number_raw' }],
      });
    });

    it('throws BadRequestException for an unsupported file type', async () => {
      const file = { originalname: 'cases.pdf', mimetype: 'application/pdf', buffer: Buffer.from('data') } as Express.Multer.File;

      await expect(controller.importCases(file)).rejects.toThrow('Unsupported file type');
    });
  });
```

Add the corresponding imports at the top of `src/cases/cases.controller.spec.ts`:

```typescript
import { CaseImportService } from './import/case-import.service';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/cases/cases.controller.spec.ts`
Expected: FAIL — `controller.importCases is not a function`

- [ ] **Step 3: Add the import route to CasesController**

Edit `src/cases/cases.controller.ts` — add imports and the new method. Full updated file:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CasesService } from './cases.service';
import { CaseImportService } from './import/case-import.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

const EXCEL_MIMETYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('archive/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasesController {
  constructor(
    private casesService: CasesService,
    private caseImportService: CaseImportService,
  ) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Get()
  @Roles('admin', 'petugas')
  findAll() {
    return this.casesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'petugas')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'petugas')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseStatusDto) {
    return this.casesService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.casesService.remove(id);
  }

  @Post('import')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async importCases(@UploadedFile() file: Express.Multer.File) {
    const isCsv = file.mimetype === 'text/csv';
    const isExcel = file.mimetype === EXCEL_MIMETYPE;

    if (!isCsv && !isExcel) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const result = isCsv
      ? await this.caseImportService.importFromCsv(file.buffer)
      : await this.caseImportService.importFromExcel(file.buffer);

    return {
      status: result.rejectedRows.length > 0 ? 'partial_success' : 'success',
      imported_count: result.importedCount,
      rejected_rows: result.rejectedRows,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/cases/cases.controller.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Wire CaseImportService into CasesModule**

Edit `src/cases/cases.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseImportService } from './import/case-import.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CasesController],
  providers: [CasesService, CaseImportService],
  exports: [CasesService],
})
export class CasesModule {}
```

- [ ] **Step 6: Write an e2e test proving the import endpoint end-to-end**

Create `test/cases-import.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cases CSV import (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let petugasToken: string;
  const importedCaseNumbers = ['901/Pdt.G/2026/PN.Test', '902/Pdt.G/2026/PN.Test'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

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
    await prisma.courtCase.deleteMany({ where: { caseNumberRaw: { in: importedCaseNumbers } } });
    await app.close();
  });

  it('rejects petugas with 403', async () => {
    const csv = 'case_number_raw,case_type,year,parties_involved,rack_name,row_number,file_position_number\n';
    await request(app.getHttpServer())
      .post('/api/v1/archive/cases/import')
      .set('Authorization', `Bearer ${petugasToken}`)
      .attach('file', Buffer.from(csv), 'cases.csv')
      .expect(403);
  });

  it('imports valid rows and reports rejected rows for admin', async () => {
    const csv =
      'case_number_raw,case_type,year,parties_involved,rack_name,row_number,file_position_number\n' +
      `${importedCaseNumbers[0]},Pdt.G,2026,E2E Party One,,,\n` +
      `,Pdt.G,2026,Missing Number Party,,,\n` +
      `${importedCaseNumbers[1]},Pdt.G,2026,E2E Party Two,,,\n`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/archive/cases/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csv), 'cases.csv')
      .expect(201);

    expect(response.body.status).toBe('partial_success');
    expect(response.body.imported_count).toBe(2);
    expect(response.body.rejected_rows).toEqual([{ row: 2, reason: 'Missing case_number_raw' }]);

    const persisted = await prisma.courtCase.findMany({
      where: { caseNumberRaw: { in: importedCaseNumbers } },
    });
    expect(persisted).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Run the e2e test**

Run: `npm run test:e2e`
Expected: PASS — all e2e files together (`app.e2e-spec.ts`, `cases.e2e-spec.ts`, `cases-import.e2e-spec.ts`).

- [ ] **Step 8: Run the full unit suite one final time**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 9: Commit**

```bash
git add court-archive-backend/src/cases/cases.controller.ts court-archive-backend/src/cases/cases.controller.spec.ts court-archive-backend/src/cases/cases.module.ts court-archive-backend/test/cases-import.e2e-spec.ts
git commit -m "feat: add Admin-only CSV/Excel import endpoint for court cases"
```

---

## Plan Complete — What Exists Now

- Admin-only CRUD for `shelves` (`/api/v1/archive/shelves`) and `court_cases` (`/api/v1/archive/cases`), both Petugas-readable for cases.
- `PATCH /api/v1/archive/cases/:id/status` — Admin and Petugas, status field only, verified via e2e that other fields can't be smuggled in.
- `POST /api/v1/archive/cases/import` — Admin-only CSV/Excel import with per-row validation, partial-success reporting, and shelf resolution by `rack_name` + `row_number`.
- The disposable `demo` module from Plan 1 is gone; `ShelvesController`/`CasesController` are the real endpoints proving the same guard pattern.

**Not yet built (deferred to later plans):** voice search/parsing and the `tts_payload` builder (Plan 3), and the entire frontend (Plan 4).
