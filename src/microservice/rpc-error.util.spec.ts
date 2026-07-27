import { HttpStatus } from '@nestjs/common';
import { extractRpcStatus, isBusinessError, normalizeRpcError } from './rpc-error.util';

describe('extractRpcStatus', () => {
  it('reads status directly from the error object', () => {
    expect(extractRpcStatus({ status: 404 })).toBe(404);
  });

  it('reads status from a nested error field', () => {
    expect(extractRpcStatus({ error: { status: 403 } })).toBe(403);
  });

  it('falls back to BAD_GATEWAY when no status is found', () => {
    expect(extractRpcStatus({})).toBe(HttpStatus.BAD_GATEWAY);
    expect(extractRpcStatus(null)).toBe(HttpStatus.BAD_GATEWAY);
  });
});

describe('normalizeRpcError', () => {
  it('extracts a direct message and traceId', () => {
    const result = normalizeRpcError({ message: 'boom' }, 'trace-1');
    expect(result).toEqual({ success: false, message: 'boom', code: 'MICROSERVICE_RPC_ERROR', traceId: 'trace-1', raw: { message: 'boom' } });
  });

  it('falls back to a nested error.message and error.code', () => {
    const err = { error: { message: 'nested boom', code: 'NESTED_CODE' } };
    const result = normalizeRpcError(err, 'trace-1');
    expect(result.message).toBe('nested boom');
    expect(result.code).toBe('NESTED_CODE');
  });

  it('uses generic defaults when nothing is extractable', () => {
    const result = normalizeRpcError('not an object', 'trace-1');
    expect(result.message).toBe('Microservice RPC Error');
    expect(result.code).toBe('MICROSERVICE_RPC_ERROR');
  });
});

describe('isBusinessError', () => {
  it('returns false when no businessErrorSources are configured (default: never skip retry)', () => {
    expect(isBusinessError({ from: 'anything' })).toBe(false);
  });

  it('returns true when `from` matches a configured business error source', () => {
    expect(isBusinessError({ from: 'payment-service' }, ['payment-service', 'auth-service'])).toBe(true);
  });

  it('returns false when `from` does not match any configured source', () => {
    expect(isBusinessError({ from: 'unrelated-service' }, ['payment-service'])).toBe(false);
  });
});
