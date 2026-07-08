import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const isDev = process.env.NODE_ENV === 'development';
    const message = isHttpException
      ? exception.getResponse()
      : isDev
        ? (exception as Error).message
        : 'Internal server error';

    response.status(status).json({ statusCode: status, message });
  }
}
