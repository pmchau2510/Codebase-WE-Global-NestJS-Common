import { ClsService } from 'nestjs-cls';
import { TRACE_CLS_KEY } from './constants';
import { TraceContextService } from './trace-context';

function createClsMock(isActive: boolean): jest.Mocked<ClsService> {
  return {
    isActive: jest.fn(() => isActive),
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as jest.Mocked<ClsService>;
}

describe('TraceContextService', () => {
  it('reads the trace id from CLS when active', () => {
    const cls = createClsMock(true);
    (cls.get as jest.Mock).mockReturnValue('trace-1');
    const service = new TraceContextService(cls);

    expect(service.getTraceId()).toBe('trace-1');
    expect(cls.get).toHaveBeenCalledWith(TRACE_CLS_KEY);
  });

  it('returns undefined without touching CLS when not active', () => {
    const cls = createClsMock(false);
    const service = new TraceContextService(cls);

    expect(service.getTraceId()).toBeUndefined();
    expect(cls.get).not.toHaveBeenCalled();
  });

  it('sets the trace id under the shared CLS key', () => {
    const cls = createClsMock(true);
    const service = new TraceContextService(cls);

    service.setTraceId('trace-2');
    expect(cls.set).toHaveBeenCalledWith(TRACE_CLS_KEY, 'trace-2');
  });
});
