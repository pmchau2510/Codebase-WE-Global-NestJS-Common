import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

export const TENANT_CLS_KEY = 'tenantId';

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  getTenantId(): string | undefined {
    return this.cls.isActive() ? this.cls.get(TENANT_CLS_KEY) : undefined;
  }

  setTenantId(tenantId: string | undefined): void {
    this.cls.set(TENANT_CLS_KEY, tenantId);
  }
}
