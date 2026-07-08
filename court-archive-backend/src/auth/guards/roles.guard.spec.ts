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
