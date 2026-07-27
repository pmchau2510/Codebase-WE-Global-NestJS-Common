import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { of } from 'rxjs';
import { TRACE_CLS_KEY } from '../tracing';
import { RpcClsInterceptor } from './rpc-cls.interceptor';

function createClsMock(): jest.Mocked<ClsService> {
  return {
    run: jest.fn((fn: () => unknown) => fn()),
    set: jest.fn(),
  } as unknown as jest.Mocked<ClsService>;
}

function createContext(data: Record<string, string>): ExecutionContext {
  return {
    switchToRpc: () => ({ getData: () => data }),
  } as unknown as ExecutionContext;
}

function createHandler(): jest.Mocked<CallHandler> {
  return { handle: jest.fn(() => of('handled')) };
}

describe('RpcClsInterceptor', () => {
  it('sets the traceId from the RPC payload into a fresh CLS run', () => {
    const cls = createClsMock();
    const interceptor = new RpcClsInterceptor(cls);
    const handler = createHandler();

    interceptor.intercept(createContext({ traceId: 'trace-1' }), handler);

    expect(cls.run).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith(TRACE_CLS_KEY, 'trace-1');
    expect(handler.handle).toHaveBeenCalled();
  });

  it('does not set anything when the payload has no traceId', () => {
    const cls = createClsMock();
    const interceptor = new RpcClsInterceptor(cls);
    const handler = createHandler();

    interceptor.intercept(createContext({}), handler);

    expect(cls.set).not.toHaveBeenCalled();
    expect(handler.handle).toHaveBeenCalled();
  });

  it('passes through the handler result', (done) => {
    const cls = createClsMock();
    const interceptor = new RpcClsInterceptor(cls);
    const handler = createHandler();

    interceptor.intercept(createContext({ traceId: 'trace-1' }), handler).subscribe((value) => {
      expect(value).toBe('handled');
      done();
    });
  });
});
