import { Observable, timer } from 'rxjs';

export const NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'EPIPE', 'ENETUNREACH'];

export function isRetryableNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const errObj = err as Record<string, unknown>;
  if (typeof errObj.code === 'string' && NETWORK_ERROR_CODES.includes(errObj.code)) {
    return true;
  }

  const msg = typeof errObj.message === 'string' ? errObj.message : '';
  return msg.includes('timeout');
}

export function getBackoffDelay(attempt: number, baseMs = 200): number {
  const exp = Math.pow(2, attempt) * baseMs; // 200, 400, 800, 1600...
  const jitter = Math.random() * 0.3 * exp; // 0-30% jitter
  return exp + jitter;
}

export function backoffTimer(attempt: number, baseMs = 200): Observable<number> {
  return timer(getBackoffDelay(attempt, baseMs));
}
