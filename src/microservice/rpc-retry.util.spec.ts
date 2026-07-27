import { getBackoffDelay, isRetryableNetworkError, NETWORK_ERROR_CODES } from './rpc-retry.util';

describe('isRetryableNetworkError', () => {
  it.each(NETWORK_ERROR_CODES)('treats %s as retryable', (code) => {
    expect(isRetryableNetworkError({ code })).toBe(true);
  });

  it('treats a timeout message as retryable', () => {
    expect(isRetryableNetworkError({ message: 'operation timeout exceeded' })).toBe(true);
  });

  it('treats an unrelated error as not retryable', () => {
    expect(isRetryableNetworkError({ code: 'SOME_OTHER_CODE', message: 'nope' })).toBe(false);
  });

  it('treats non-object values as not retryable', () => {
    expect(isRetryableNetworkError(null)).toBe(false);
    expect(isRetryableNetworkError('boom')).toBe(false);
  });
});

describe('getBackoffDelay', () => {
  it('grows exponentially with attempt, within jitter bounds', () => {
    const base = 200;
    for (let attempt = 0; attempt < 4; attempt++) {
      const delay = getBackoffDelay(attempt, base);
      const exp = Math.pow(2, attempt) * base;
      expect(delay).toBeGreaterThanOrEqual(exp);
      expect(delay).toBeLessThanOrEqual(exp * 1.3);
    }
  });
});
