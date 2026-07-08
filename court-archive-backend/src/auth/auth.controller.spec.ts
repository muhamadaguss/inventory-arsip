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
    authService.validateUser.mockResolvedValue({
      id: 1,
      username: 'clerk1',
      role: 'petugas',
    });
    authService.login.mockReturnValue({
      token: 'signed.jwt.token',
      role: 'petugas',
    });

    const result = await controller.login({
      username: 'clerk1',
      password: 'correct',
    });

    expect(authService.validateUser).toHaveBeenCalledWith('clerk1', 'correct');
    expect(result).toEqual({ token: 'signed.jwt.token', role: 'petugas' });
  });

  it('throws UnauthorizedException on invalid credentials', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(
      controller.login({ username: 'clerk1', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
