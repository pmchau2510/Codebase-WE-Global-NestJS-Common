import { BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ILike, Repository } from 'typeorm';
import { methodFactory } from './method-factory';
import { Identifiable } from './types';

interface TestEntity extends Identifiable<string> {
  id: string;
  name?: string;
  email?: string;
  tenantId?: string;
}

function createQueryBuilderMock() {
  const qb: Record<string, jest.Mock> = {};
  qb.andWhere = jest.fn(() => qb);
  qb.addOrderBy = jest.fn(() => qb);
  qb.skip = jest.fn(() => qb);
  qb.take = jest.fn(() => qb);
  qb.getManyAndCount = jest.fn(() => Promise.resolve([[], 0]));
  return qb;
}

function createRepoMock(deleteDateColumn?: { propertyName: string }): jest.Mocked<Repository<TestEntity>> {
  return {
    metadata: { name: 'TestEntity', deleteDateColumn },
    find: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn((input?: unknown) => input),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    findAndCount: jest.fn(),
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
    manager: { transaction: jest.fn((cb: (manager: unknown) => unknown) => cb({})) },
  } as unknown as jest.Mocked<Repository<TestEntity>>;
}

function createClsMock(tenantId: string | undefined, isActive = true): jest.Mocked<ClsService> {
  return {
    isActive: jest.fn(() => isActive),
    get: jest.fn(() => tenantId),
    set: jest.fn(),
  } as unknown as jest.Mocked<ClsService>;
}

describe('methodFactory', () => {
  describe('tenant scoping', () => {
    it('does not add a tenant filter when tenantColumn is not configured', async () => {
      const repo = createRepoMock();
      const cls = createClsMock('tenant-1');
      const method = methodFactory(repo, cls);

      await method.find({ name: 'a' });

      expect(repo.find).toHaveBeenCalledWith({ where: { name: 'a' }, relations: undefined, withDeleted: undefined });
      expect(cls.get).not.toHaveBeenCalled();
    });

    it('adds the tenant filter when tenantColumn is configured and CLS is active', async () => {
      const repo = createRepoMock();
      const cls = createClsMock('tenant-1');
      const method = methodFactory(repo, cls, { tenantColumn: 'tenantId' });

      await method.find({ name: 'a' });

      expect(repo.find).toHaveBeenCalledWith({
        where: { name: 'a', tenantId: 'tenant-1' },
        relations: undefined,
        withDeleted: undefined,
      });
    });

    it('skips the tenant filter when CLS is not active, even with tenantColumn configured', async () => {
      const repo = createRepoMock();
      const cls = createClsMock('tenant-1', false);
      const method = methodFactory(repo, cls, { tenantColumn: 'tenantId' });

      await method.count({});

      expect(repo.count).toHaveBeenCalledWith({ where: {} });
    });
  });

  describe('select option', () => {
    it('passes select through on find', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({}, { select: { id: true, name: true } });

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, name: true } }));
    });

    it('passes select through on findOne', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.findOne({ id: '1' }, { select: { id: true, name: true } });

      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, name: true } }));
    });
  });

  describe('idsOnly option', () => {
    it('returns an array of ids instead of full entities', async () => {
      const repo = createRepoMock();
      repo.find.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const method = methodFactory(repo, createClsMock(undefined));

      const ids = await method.find({}, { idsOnly: true });

      expect(ids).toEqual(['1', '2']);
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true } }));
    });
  });

  describe('search option', () => {
    it('is a no-op when searchColumns is not configured', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({ name: 'x' }, { search: 'john' });

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'x' } }));
    });

    it('ORs ILike across searchColumns, ANDed with the rest of the where clause', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined), { searchColumns: ['name', 'email'] });

      await method.find({ tenantId: 't1' }, { search: 'john' });

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { tenantId: 't1', name: ILike('%john%') },
            { tenantId: 't1', email: ILike('%john%') },
          ],
        }),
      );
    });

    it('applies the same search behavior to paginate', async () => {
      const repo = createRepoMock();
      repo.findAndCount.mockResolvedValue([[], 0]);
      const method = methodFactory(repo, createClsMock(undefined), { searchColumns: ['name'] });

      await method.paginate({}, { skip: 0, limit: 10 }, { search: 'x' });

      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: [{ name: ILike('%x%') }] }));
    });
  });

  describe('skip/limit option', () => {
    it('passes skip/limit through as take/skip on find', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({}, { skip: 20, limit: 10 });

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('applies skip/limit on the idsOnly branch too', async () => {
      const repo = createRepoMock();
      repo.find.mockResolvedValue([{ id: '1' }]);
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({}, { idsOnly: true, skip: 20, limit: 10 });

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });

  describe('sort option', () => {
    it('passes a flat sort key through as-is on find', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({}, { sort: { name: 'ASC' } });

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { name: 'ASC' } }));
    });

    it('builds a nested order clause for a dot-path sort key on find', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({}, { sort: { 'company.name': 'ASC' } });

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { company: { name: 'ASC' } } }));
    });

    it('merges multiple dot-path sort keys sharing the same relation prefix', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({}, { sort: { 'company.name': 'ASC', 'company.foundedYear': 'DESC' } });

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { company: { name: 'ASC', foundedYear: 'DESC' } } }),
      );
    });

    it('omits order entirely when no sort is given', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      await method.find({});

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ order: undefined }));
    });

    it('builds a nested order clause on paginate too', async () => {
      const repo = createRepoMock();
      repo.findAndCount.mockResolvedValue([[], 0]);
      const method = methodFactory(repo, createClsMock(undefined));

      await method.paginate({}, { skip: 0, limit: 10, sort: { 'company.name': 'DESC' } });

      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { company: { name: 'DESC' } } }));
    });
  });

  describe('findOne', () => {
    it('returns null when not found and isThrow is not set', async () => {
      const repo = createRepoMock();
      repo.findOne.mockResolvedValue(null);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.findOne({ id: '1' })).resolves.toBeNull();
    });

    it('throws BadRequestException when not found and isThrow is true', async () => {
      const repo = createRepoMock();
      repo.findOne.mockResolvedValue(null);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.findOne({ id: '1' }, { isThrow: true })).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('delegates to findOne with an id filter', async () => {
      const repo = createRepoMock();
      const found: TestEntity = { id: '1' };
      repo.findOne.mockResolvedValue(found);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.findById('1')).resolves.toBe(found);
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: '1' } }));
    });
  });

  describe('exists', () => {
    it('throws IF_EXISTS when the record already exists', async () => {
      const repo = createRepoMock();
      repo.exists.mockResolvedValue(true);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.exists({ id: '1' }, { throwCase: 'IF_EXISTS' })).rejects.toThrow(BadRequestException);
    });

    it('throws IF_NOT_EXISTS when the record is missing', async () => {
      const repo = createRepoMock();
      repo.exists.mockResolvedValue(false);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.exists({ id: '1' }, { throwCase: 'IF_NOT_EXISTS' })).rejects.toThrow(BadRequestException);
    });

    it('returns the boolean without throwing when no throwCase is given', async () => {
      const repo = createRepoMock();
      repo.exists.mockResolvedValue(true);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.exists({ id: '1' })).resolves.toBe(true);
    });
  });

  describe('existsAll', () => {
    it('reports isExistsOne/isExistsAll based on the matched count', async () => {
      const repo = createRepoMock();
      repo.count.mockResolvedValue(2);
      const method = methodFactory(repo, createClsMock(undefined));

      const result = await method.existsAll(['1', '2', '3']);
      expect(result).toEqual({ isExistsOne: true, isExistsAll: false });
    });

    it('throws IF_ALL_NOT_EXISTS when none of the ids match', async () => {
      const repo = createRepoMock();
      repo.count.mockResolvedValue(0);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.existsAll(['1', '2'], { throwCase: 'IF_ALL_NOT_EXISTS' })).rejects.toThrow(BadRequestException);
    });

    it('deduplicates ids before counting', async () => {
      const repo = createRepoMock();
      repo.count.mockResolvedValue(1);
      const method = methodFactory(repo, createClsMock(undefined));

      const result = await method.existsAll(['1', '1', '1']);
      expect(result).toEqual({ isExistsOne: true, isExistsAll: true });
    });
  });

  describe('create', () => {
    it('assigns the tenant column before saving when configured', async () => {
      const repo = createRepoMock();
      const cls = createClsMock('tenant-1');
      const method = methodFactory(repo, cls, { tenantColumn: 'tenantId' });

      await method.create({ name: 'a' });

      expect(repo.create).toHaveBeenCalledWith({ name: 'a', tenantId: 'tenant-1' });
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates then re-fetches the record', async () => {
      const repo = createRepoMock();
      const updated: TestEntity = { id: '1', name: 'b' };
      repo.findOne.mockResolvedValue(updated);
      const method = methodFactory(repo, createClsMock(undefined));

      await expect(method.update({ id: '1' }, { name: 'b' })).resolves.toBe(updated);
      expect(repo.update).toHaveBeenCalledWith({ id: '1' }, { name: 'b' });
    });
  });

  describe('delete / softDelete / restore', () => {
    it('calls the matching repository method with the tenant-scoped where clause', async () => {
      const repo = createRepoMock();
      const cls = createClsMock('tenant-1');
      const method = methodFactory(repo, cls, { tenantColumn: 'tenantId' });

      await method.delete({ id: '1' });
      expect(repo.delete).toHaveBeenCalledWith({ id: '1', tenantId: 'tenant-1' });

      await method.softDelete({ id: '2' });
      expect(repo.softDelete).toHaveBeenCalledWith({ id: '2', tenantId: 'tenant-1' });

      await method.restore({ id: '3' });
      expect(repo.restore).toHaveBeenCalledWith({ id: '3', tenantId: 'tenant-1' });
    });
  });

  describe('paginate', () => {
    it('maps QueryParams to skip/take/order', async () => {
      const repo = createRepoMock();
      repo.findAndCount.mockResolvedValue([[{ id: '1' }], 1]);
      const method = methodFactory(repo, createClsMock(undefined));

      const result = await method.paginate({}, { skip: 10, limit: 5, sort: { name: 'ASC' } });

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 10,
        take: 5,
        order: { name: 'ASC' },
      });
      expect(result).toEqual({ data: [{ id: '1' }], total: 1 });
    });
  });

  describe('createQueryBuilder', () => {
    it('adds a tenant filter when tenantColumn is configured', () => {
      const repo = createRepoMock();
      const cls = createClsMock('tenant-1');
      const method = methodFactory(repo, cls, { tenantColumn: 'tenantId' });

      const qb = method.createQueryBuilder('entity');

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('entity');
      expect(qb.andWhere).toHaveBeenCalledWith('entity.tenantId = :tenantId', { tenantId: 'tenant-1' });
    });

    it('does not add a tenant filter when tenantColumn is not configured', () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock('tenant-1'));

      const qb = method.createQueryBuilder('entity');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('excludes soft-deleted rows when the entity has a delete date column', () => {
      const repo = createRepoMock({ propertyName: 'deletedAt' });
      const method = methodFactory(repo, createClsMock(undefined));

      const qb = method.createQueryBuilder('entity');

      expect(qb.andWhere).toHaveBeenCalledWith('entity.deletedAt IS NULL');
    });

    it('does not filter soft-deleted rows when the entity has no delete date column', () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      const qb = method.createQueryBuilder('entity');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('defaults the alias to the lowercased entity name', () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      method.createQueryBuilder();

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('testentity');
    });
  });

  describe('paginateQueryBuilder', () => {
    it('applies sort, skip and take, then returns data/total from getManyAndCount', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));
      const qb = repo.createQueryBuilder('entity');
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[{ id: '1' }], 1]);

      const result = await method.paginateQueryBuilder(qb, { skip: 10, limit: 5, sort: { name: 'ASC' } }, 'entity');

      expect(qb.addOrderBy).toHaveBeenCalledWith('entity.name', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(result).toEqual({ data: [{ id: '1' }], total: 1 });
    });

    it('leaves sort field names unqualified when no alias is given', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));
      const qb = repo.createQueryBuilder('entity');

      await method.paginateQueryBuilder(qb, { skip: 0, limit: 10, sort: { name: 'ASC' } });

      expect(qb.addOrderBy).toHaveBeenCalledWith('name', 'ASC');
    });
  });

  describe('transaction', () => {
    it('delegates to repo.manager.transaction', async () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      const result = await method.transaction(async () => 'done');
      expect(result).toBe('done');
      expect(repo.manager.transaction).toHaveBeenCalled();
    });
  });

  describe('createInstance', () => {
    it('creates an empty instance when no input is given', () => {
      const repo = createRepoMock();
      const method = methodFactory(repo, createClsMock(undefined));

      method.createInstance();
      expect(repo.create).toHaveBeenCalledWith();
    });
  });
});
