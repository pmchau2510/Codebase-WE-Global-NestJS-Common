import { AxiosError } from 'axios';

export type IntegrationErrorCode =
  | 'INTEGRATION_TIMEOUT'
  | 'INTEGRATION_NETWORK_ERROR'
  | 'INTEGRATION_BAD_REQUEST'
  | 'INTEGRATION_UNAUTHORIZED'
  | 'INTEGRATION_FORBIDDEN'
  | 'INTEGRATION_NOT_FOUND'
  | 'INTEGRATION_RATE_LIMIT'
  | 'INTEGRATION_SERVER_ERROR'
  | 'INTEGRATION_UNKNOWN';

export interface IntegrationErrorResponse {
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface ParamsError {
  message: string;
  code: IntegrationErrorCode;
  provider: string;
  status?: number;
  errors?: unknown;
  metadata?: unknown;
}

export class IntegrationError extends Error {
  readonly isIntegrationError = true;
  readonly code: string;
  readonly provider: string;
  readonly status?: number;
  readonly errors?: unknown;
  readonly metadata?: unknown;

  constructor(params: ParamsError) {
    super(params.message);
    this.name = 'IntegrationError';
    this.code = params.code;
    this.provider = params.provider;
    this.status = params.status;
    this.errors = params.errors;
    this.metadata = params.metadata;
  }

  static fromAxios(error: unknown, provider: string): IntegrationError {
    if (isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return new IntegrationError({
          message: 'Integration request timeout',
          code: 'INTEGRATION_TIMEOUT',
          provider,
        });
      }

      if (!error.response) {
        return new IntegrationError({
          message: error.message || 'Integration network error',
          code: 'INTEGRATION_NETWORK_ERROR',
          provider,
        });
      }

      const status = error.response.status;
      const data = error.response.data as IntegrationErrorResponse | undefined;
      const providerMessage = data?.error?.message || data?.message || error.message || 'Integration error';

      switch (status) {
        case 400:
          return new IntegrationError({
            message: providerMessage,
            code: 'INTEGRATION_BAD_REQUEST',
            provider,
            status,
            errors: data?.error,
            metadata: data,
          });

        case 401:
          return new IntegrationError({ message: providerMessage, code: 'INTEGRATION_UNAUTHORIZED', provider, status });

        case 403:
          return new IntegrationError({ message: providerMessage, code: 'INTEGRATION_FORBIDDEN', provider, status });

        case 404:
          return new IntegrationError({ message: providerMessage, code: 'INTEGRATION_NOT_FOUND', provider, status });

        case 429:
          return new IntegrationError({ message: providerMessage, code: 'INTEGRATION_RATE_LIMIT', provider, status });

        default:
          return new IntegrationError({
            message: providerMessage,
            code: 'INTEGRATION_SERVER_ERROR',
            provider,
            status,
            metadata: data,
          });
      }
    }

    if (error instanceof Error) {
      return new IntegrationError({ message: error.message, code: 'INTEGRATION_UNKNOWN', provider });
    }

    return new IntegrationError({ message: String(error), code: 'INTEGRATION_UNKNOWN', provider });
  }
}

function isAxiosError(error: unknown): error is AxiosError {
  return typeof error === 'object' && error !== null && (error as AxiosError).isAxiosError === true;
}
