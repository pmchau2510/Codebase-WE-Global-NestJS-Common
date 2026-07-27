import { ArgumentsHost } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response } from 'express';
import { DomainError } from '../errors/domain.error';
import { ILogger } from '../logging';
import { GlobalExceptionFilter } from './global-exception.filter';

function createLoggerMock(): jest.Mocked<ILogger> {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

function createClsMock(traceId: string | undefined, isActive = true): jest.Mocked<ClsService> {
  return {
    isActive: jest.fn(() => isActive),
    get: jest.fn(() => traceId),
    set: jest.fn(),
  } as unknown as jest.Mocked<ClsService>;
}

function createHost(): { host: ArgumentsHost; response: jest.Mocked<Response> } {
  const request = {
    method: 'GET',
    url: '/test',
    body: {},
    query: {},
    headers: { 'user-agent': 'jest', referer: undefined },
  } as unknown as Request;

  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as jest.Mocked<Response>;

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('GlobalExceptionFilter', () => {
  it('writes the mapped status/body and includes the traceId from CLS', () => {
    const logger = createLoggerMock();
    const cls = createClsMock('trace-1');
    const filter = new GlobalExceptionFilter(logger, cls);
    const { host, response } = createHost();

    filter.catch(new DomainError('USER.NOT_FOUND', { httpStatus: 404 }), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'USER.NOT_FOUND',
        traceId: 'trace-1',
        path: '/test',
      }),
    );
  });

  it('uses traceId: null when CLS is not active', () => {
    const logger = createLoggerMock();
    const cls = createClsMock('trace-1', false);
    const filter = new GlobalExceptionFilter(logger, cls);
    const { host, response } = createHost();

    filter.catch(new Error('boom'), host);

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ traceId: null }));
  });

  it('omits data/metadata keys when empty', () => {
    const logger = createLoggerMock();
    const cls = createClsMock(undefined, false);
    const filter = new GlobalExceptionFilter(logger, cls);
    const { host, response } = createHost();

    filter.catch(new Error('boom'), host);

    const body = response.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('data');
    expect(body).not.toHaveProperty('metadata');
  });

  it('logs the exception with source GlobalExceptionFilter and notify: true', () => {
    const logger = createLoggerMock();
    const cls = createClsMock(undefined, false);
    const filter = new GlobalExceptionFilter(logger, cls);
    const { host } = createHost();
    const error = new Error('boom');

    filter.catch(error, host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      expect.objectContaining({ exception: error, stack: error.stack }),
      { source: 'GlobalExceptionFilter', notify: true },
    );
  });
});
