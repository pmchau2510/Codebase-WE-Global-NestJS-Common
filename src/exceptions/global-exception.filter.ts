import { ArgumentsHost, Catch, ExceptionFilter, Inject } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ILogger, LOGGER_TOKEN } from '../logging';
import { TRACE_CLS_KEY } from '../tracing';
import { getExceptionDetails } from './exception.helper';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    if (!ctx) return;

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const i18n = I18nContext.current(host);

    const method = request.method;
    const url = request.url;
    const reqBody = request.body as Record<string, unknown>;
    const query = request.query as Record<string, unknown>;
    const headers = request.headers;
    const requestInfo = {
      method,
      url,
      query,
      body: JSON.stringify(reqBody),
      headers: { 'user-agent': headers['user-agent'], referer: headers['referer'] },
    };

    const { status, errorCode, message, data, metadata } = getExceptionDetails(exception, i18n);
    const traceId = this.cls.isActive() ? (this.cls.get<string>(TRACE_CLS_KEY) ?? null) : null;

    const errorResponse = {
      success: false,
      code: errorCode,
      message,
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(data && Object.keys(data).length > 0 && { data }),
      ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
    };

    const logMessage = typeof errorResponse.message === 'string' ? errorResponse.message : JSON.stringify(errorResponse.message);

    this.logger.error(
      `HTTP Exception => ${logMessage}`,
      {
        stack: exception instanceof Error ? exception.stack : undefined,
        requestInfo,
        exception,
      },
      { source: 'GlobalExceptionFilter', notify: true },
    );

    response.status(status).json(errorResponse);
  }
}
