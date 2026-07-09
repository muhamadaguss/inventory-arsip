import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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

  it('rejects a status update body carrying unexpected fields, proving the route cannot smuggle in other edits', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/archive/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ status: 'Borrowed', partiesInvolved: 'Smuggled Name Change' })
      .expect(400);

    const unchanged = await prisma.courtCase.findUnique({ where: { id: caseId } });
    expect(unchanged?.partiesInvolved).toBe('E2E Test Party');
  });

  it('rejects an invalid status value with 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/archive/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NotARealStatus' })
      .expect(400);
  });
});
