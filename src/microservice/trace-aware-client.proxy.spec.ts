import { HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { defer, of, throwError } from 'rxjs';
import { ILogger } from '../logging';
import { TraceAwareClientProxy } from './trace-aware-client.proxy';

function createLoggerMock(): jest.Mocked<ILogger> {
  return { trace: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() };
}

function createClsMock(traceId: string | undefined, isActive = true): jest.Mocked<ClsService> {
  return { isActive: jest.fn(() => isActive), get: jest.fn(() => traceId), set: jest.fn() } as unknown as jest.Mocked<ClsService>;
}

function createClientMock(): jest.Mocked<ClientProxy> {
  return {
    send: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ClientProxy>;
}

describe('TraceAwareClientProxy.send', () => {
  it('includes the traceId from CLS in the outgoing envelope', async () => {
    const client = createClientMock();
    client.send.mockReturnValue(of('ok'));
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock('trace-1'));

    await proxy.send('pattern', { foo: 'bar' });

    expect(client.send).toHaveBeenCalledWith('pattern', { data: { foo: 'bar' }, traceId: 'trace-1' });
  });

  it('omits traceId when CLS is not active', async () => {
    const client = createClientMock();
    client.send.mockReturnValue(of('ok'));
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock('trace-1', false));

    await proxy.send('pattern', { foo: 'bar' });

    expect(client.send).toHaveBeenCalledWith('pattern', { data: { foo: 'bar' } });
  });

  it('resolves with the response on success', async () => {
    const client = createClientMock();
    client.send.mockReturnValue(of({ value: 42 }));
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock(undefined, false));

    await expect(proxy.send('pattern', {})).resolves.toEqual({ value: 42 });
  });

  it('reconnects and retries on a retryable network error, then succeeds', async () => {
    const client = createClientMock();
    let attempt = 0;
    client.send.mockReturnValue(
      defer(() => {
        attempt++;
        return attempt === 1 ? throwError(() => ({ code: 'ECONNRESET' })) : of('recovered');
      }),
    );
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock(undefined, false));

    await expect(proxy.send('pattern', {}, { baseDelayMs: 1 })).resolves.toBe('recovered');
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('does not retry a business error — throws immediately without reconnecting', async () => {
    const client = createClientMock();
    client.send.mockReturnValue(throwError(() => ({ from: 'payment-service', status: 422, message: 'rule violated' })));
    const logger = createLoggerMock();
    const proxy = new TraceAwareClientProxy(logger, client, createClsMock(undefined, false), {
      businessErrorSources: ['payment-service'],
    });

    await expect(proxy.send('pattern', {})).rejects.toThrow(HttpException);
    expect(client.close).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('RPC call failed', expect.anything(), { source: 'TraceAwareClientProxy' });
  });

  it('does not retry a non-network, non-business error — throws immediately', async () => {
    const client = createClientMock();
    client.send.mockReturnValue(throwError(() => ({ status: 400, message: 'bad request' })));
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock(undefined, false));

    await expect(proxy.send('pattern', {})).rejects.toThrow(HttpException);
    expect(client.close).not.toHaveBeenCalled();
  });
});

describe('TraceAwareClientProxy.emit', () => {
  it('includes the traceId from CLS in the emitted envelope', () => {
    const client = createClientMock();
    client.emit.mockReturnValue(of(undefined));
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock('trace-1'));

    proxy.emit('pattern', { foo: 'bar' });

    expect(client.emit).toHaveBeenCalledWith('pattern', { data: { foo: 'bar' }, traceId: 'trace-1' });
  });

  it('omits traceId when CLS is not active', () => {
    const client = createClientMock();
    client.emit.mockReturnValue(of(undefined));
    const proxy = new TraceAwareClientProxy(createLoggerMock(), client, createClsMock('trace-1', false));

    proxy.emit('pattern', { foo: 'bar' });

    expect(client.emit).toHaveBeenCalledWith('pattern', { data: { foo: 'bar' } });
  });
});
