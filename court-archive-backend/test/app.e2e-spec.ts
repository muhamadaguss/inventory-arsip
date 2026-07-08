import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
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
    await request(app.getHttpServer())
      .get('/api/v1/demo/admin-only')
      .expect(401);
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

    expect(response.body).toEqual({
      message: 'You are an authenticated admin.',
    });
  });
});
