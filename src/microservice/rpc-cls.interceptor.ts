import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { TRACE_CLS_KEY } from '../tracing';

/**
 * Counterpart to TraceAwareClientProxy on the receiving side of a TCP/RPC handler:
 * reads the `traceId` field off the incoming RpcEnvelope payload and sets it in a
 * fresh CLS run context, so the rest of the request pipeline can log/propagate it.
 */
@Injectable()
export class RpcClsInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return this.cls.run(() => {
      const data = context.switchToRpc().getData<Record<string, string>>();
      const traceId = data?.traceId;

      if (traceId) {
        this.cls.set(TRACE_CLS_KEY, traceId);
      }

      return next.handle();
    });
  }
}
