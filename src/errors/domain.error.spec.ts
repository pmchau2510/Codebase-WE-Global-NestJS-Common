import { DomainError } from './domain.error';

describe('DomainError', () => {
  it('defaults httpStatus to 500 and message to code', () => {
    const err = new DomainError('SOME.CODE');
    expect(err.httpStatus).toBe(500);
    expect(err.message).toBe('SOME.CODE');
    expect(err.isDomainError).toBe(true);
  });

  it('honors provided message, httpStatus and metadata', () => {
    const err = new DomainError('TENANT.NOT_FOUND', {
      httpStatus: 404,
      message: 'Tenant not found',
      metadata: { tenantId: 'abc' },
    });
    expect(err.httpStatus).toBe(404);
    expect(err.message).toBe('Tenant not found');
    expect(err.metadata).toEqual({ tenantId: 'abc' });
  });

  it('survives instanceof checks through subclassing', () => {
    class NotFoundError extends DomainError {
      constructor() {
        super('NOT_FOUND', { httpStatus: 404 });
      }
    }
    const err = new NotFoundError();
    expect(err instanceof NotFoundError).toBe(true);
    expect(err instanceof DomainError).toBe(true);
    expect(err.name).toBe('NotFoundError');
  });
});
