import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let petugasToken: string;
  let caseId: number | null = null;
  let shelfId: number | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const petugasLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'petugas1', password: 'petugas123' });
    petugasToken = petugasLogin.body.token;

    const shelf = await prisma.shelf.create({
      data: { rackName: 'Rak Uji', rowNumber: 9 },
    });
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
    if (caseId !== null) {
      await prisma.courtCase.delete({ where: { id: caseId } });
    }
    if (shelfId !== null) {
      await prisma.shelf.delete({ where: { id: shelfId } });
    }
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
    const found = response.body.data.find(
      (item: { id: number }) => item.id === caseId,
    );
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
