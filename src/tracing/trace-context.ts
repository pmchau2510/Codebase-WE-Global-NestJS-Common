import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TRACE_CLS_KEY } from './constants';

@Injectable()
export class TraceContextService {
  constructor(private readonly cls: ClsService) {}

  getTraceId(): string | undefined {
    return this.cls.isActive() ? this.cls.get(TRACE_CLS_KEY) : undefined;
  }

  setTraceId(traceId: string | undefined): void {
    this.cls.set(TRACE_CLS_KEY, traceId);
  }
}
