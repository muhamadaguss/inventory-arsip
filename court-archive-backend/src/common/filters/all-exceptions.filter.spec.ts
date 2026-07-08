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

    filter.catch(
      new HttpException(
        'Invalid username or password',
        HttpStatus.UNAUTHORIZED,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Invalid username or password',
    });
  });

  it('masks unknown errors with a generic message outside development', () => {
    process.env.NODE_ENV = 'production';
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost();

    filter.catch(
      new Error('Prisma: connection string malformed at column 14'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
  });
});
