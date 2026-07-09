import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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
