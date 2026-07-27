import { HttpException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { catchError, firstValueFrom, from, mergeMap, Observable, retry, throwError, timeout } from 'rxjs';
import { ILogger, LOGGER_TOKEN } from '../logging';
import { TRACE_CLS_KEY } from '../tracing';
import { extractRpcStatus, isBusinessError, normalizeRpcError } from './rpc-error.util';
import { backoffTimer, isRetryableNetworkError } from './rpc-retry.util';

export interface RpcEnvelope<T> {
  data: T;
  traceId?: string;
}

export interface RpcSendOptions {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}

export interface TraceAwareClientProxyOptions {
  /** `from` identifiers that mark an RPC error as a business-rule rejection — never retried. Defaults to none. */
  businessErrorSources?: string[];
}

export class TraceAwareClientProxy {
  constructor(
    @Inject(LOGGER_TOKEN)
    private readonly logger: ILogger,
    private readonly client: ClientProxy,
    private readonly cls: ClsService,
    private readonly options: TraceAwareClientProxyOptions = {},
  ) {}

  async send<TResponse, TPayload>(pattern: string, payload: TPayload, options: RpcSendOptions = {}): Promise<TResponse> {
    const { timeoutMs, retries = 3, baseDelayMs = 200 } = options;

    const traceId = this.getTraceId();

    const message: RpcEnvelope<TPayload> = {
      data: payload,
      ...(traceId ? { traceId } : {}),
    };

    let stream$ = this.client.send<TResponse>(pattern, message);

    if (typeof timeoutMs === 'number') {
      stream$ = stream$.pipe(timeout(timeoutMs));
    }

    stream$ = stream$.pipe(
      retry({
        count: retries,
        delay: (err: unknown, retryCount: number) => {
          if (isBusinessError(err, this.options.businessErrorSources)) {
            return throwError(() => err as Error);
          }

          if (!isRetryableNetworkError(err)) {
            return throwError(() => err as Error);
          }

          return from(this.reconnectClientProxy(pattern, retryCount, err)).pipe(mergeMap(() => backoffTimer(retryCount, baseDelayMs)));
        },
      }),

      catchError((err) => {
        this.logger.error(
          'RPC call failed',
          { pattern, error: err instanceof Error ? err.message : String(JSON.stringify(err)), traceId },
          { source: 'TraceAwareClientProxy' },
        );
        const status = extractRpcStatus(err);
        const normalized = normalizeRpcError(err, traceId ?? '');
        throw new HttpException(normalized, status);
      }),
    );

    return firstValueFrom(stream$, { defaultValue: null as TResponse });
  }

  emit<TPayload>(pattern: unknown, payload: TPayload): Observable<void> {
    const traceId = this.getTraceId();

    return this.client.emit(pattern, {
      data: payload,
      ...(traceId ? { traceId } : {}),
    });
  }

  private getTraceId(): string | undefined {
    return this.cls.isActive() ? this.cls.get<string>(TRACE_CLS_KEY) : undefined;
  }

  private async reconnectClientProxy(pattern: string, retryCount: number, err: unknown): Promise<void> {
    const errorMessage = err instanceof Error ? err.message : String(JSON.stringify(err));

    this.logger.warn(
      'Retryable RPC network error detected, reconnecting client proxy',
      { pattern, retryCount, error: errorMessage },
      { source: 'TraceAwareClientProxy' },
    );

    this.client.close();
    await this.client.connect();
  }
}
