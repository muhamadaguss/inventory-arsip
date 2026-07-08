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
        { provide: JwtService, useValue: new JwtService({ secret: 'test-secret' }) },
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
