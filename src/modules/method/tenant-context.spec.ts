import { ClsService } from 'nestjs-cls';
import { TENANT_CLS_KEY, TenantContextService } from './tenant-context';

function createClsMock(isActive: boolean): jest.Mocked<ClsService> {
  return {
    isActive: jest.fn(() => isActive),
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as jest.Mocked<ClsService>;
}

describe('TenantContextService', () => {
  it('reads the tenant id from CLS when active', () => {
    const cls = createClsMock(true);
    (cls.get as jest.Mock).mockReturnValue('tenant-1');
    const service = new TenantContextService(cls);

    expect(service.getTenantId()).toBe('tenant-1');
    expect(cls.get).toHaveBeenCalledWith(TENANT_CLS_KEY);
  });

  it('returns undefined without touching CLS when not active', () => {
    const cls = createClsMock(false);
    const service = new TenantContextService(cls);

    expect(service.getTenantId()).toBeUndefined();
    expect(cls.get).not.toHaveBeenCalled();
  });

  it('sets the tenant id under the shared CLS key', () => {
    const cls = createClsMock(true);
    const service = new TenantContextService(cls);

    service.setTenantId('tenant-2');
    expect(cls.set).toHaveBeenCalledWith(TENANT_CLS_KEY, 'tenant-2');
  });
});
