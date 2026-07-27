import { HttpStatus } from '@nestjs/common';

export function extractRpcStatus(err: unknown): number {
  if (err && typeof err === 'object') {
    const errObj = err as Record<string, unknown>;

    if (typeof errObj.status === 'number') {
      return errObj.status;
    }

    if (errObj.error && typeof errObj.error === 'object') {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.status === 'number') {
        return nested.status;
      }
    }
  }

  return HttpStatus.BAD_GATEWAY;
}

export interface NormalizedRpcError {
  success: false;
  message: string;
  code: string;
  traceId: string;
  raw: unknown;
}

export function normalizeRpcError(err: unknown, traceId: string): NormalizedRpcError {
  let message = 'Microservice RPC Error';
  let code = 'MICROSERVICE_RPC_ERROR';

  const getNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  };

  if (err && typeof err === 'object') {
    const errObj = err as Record<string, unknown>;
    const directMessage = getNonEmptyString(errObj.message);
    const errorAsString = getNonEmptyString(errObj.error);
    let nestedMessage: string | null = null;
    if (errObj.error && typeof errObj.error === 'object') {
      nestedMessage = getNonEmptyString((errObj.error as Record<string, unknown>).message);
    }

    if (directMessage) {
      message = directMessage;
    } else if (errorAsString) {
      message = errorAsString;
    } else if (nestedMessage) {
      message = nestedMessage;
    }

    if (typeof errObj.error === 'object' && errObj.error !== null) {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.code === 'string') {
        code = nested.code;
      }
    }
  }

  return { success: false, message, code, traceId, raw: err };
}

/**
 * Whether `err` came from a source that should NOT be retried (a business-rule rejection,
 * not a transient network failure) — identified by its `from` field matching one of `businessErrorSources`.
 * Pass the identifiers your own services tag their business errors with; defaults to none (never skips retry).
 */
export function isBusinessError(err: unknown, businessErrorSources: string[] = []): boolean {
  if (businessErrorSources.length === 0) return false;
  if (!err || typeof err !== 'object') return false;

  const errObj = err as Record<string, unknown>;
  return typeof errObj.from === 'string' && businessErrorSources.includes(errObj.from);
}
