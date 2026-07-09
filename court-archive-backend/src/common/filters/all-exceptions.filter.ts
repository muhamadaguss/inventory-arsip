import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

const PRISMA_ERROR_STATUS: Record<string, number> = {
  P2025: HttpStatus.NOT_FOUND,
  P2003: HttpStatus.BAD_REQUEST,
  P2002: HttpStatus.CONFLICT,
};

const PRISMA_ERROR_MESSAGE: Record<string, string> = {
  P2025: 'Record not found',
  P2003: 'Related record referenced by this request does not exist',
  P2002: 'A record with this value already exists',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        PRISMA_ERROR_STATUS[exception.code] ??
        HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        PRISMA_ERROR_MESSAGE[exception.code] ?? 'Internal server error';
      response.status(status).json({ statusCode: status, message });
      return;
    }

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const isDev = process.env.NODE_ENV === 'development';
    const message = isHttpException
      ? exception.getResponse()
      : isDev
        ? (exception as Error).message
        : 'Internal server error';

    response.status(status).json({ statusCode: status, message });
  }
}
