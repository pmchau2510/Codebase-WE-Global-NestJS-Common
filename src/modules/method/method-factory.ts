import { BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  DeepPartial,
  EntityManager,
  FindOptionsOrder,
  FindOptionsSelect,
  FindOptionsWhere,
  ILike,
  In,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { QueryParams } from '../../decorators/query-options.decorator';
import { TENANT_CLS_KEY } from './tenant-context';
import { Identifiable, MethodOptions } from './types';

export type ExistsThrowCase = 'IF_EXISTS' | 'IF_NOT_EXISTS';
export type ExistsAllThrowCase = 'IF_ONE_EXISTS' | 'IF_ONE_NOT_EXISTS' | 'IF_ALL_EXISTS' | 'IF_ALL_NOT_EXISTS';

export interface FindManyOption<T = ObjectLiteral> {
  relations?: string[];
  withDeleted?: boolean;
  select?: FindOptionsSelect<T>;
  /** Matches ILIKE `%search%` against any of MethodOptions.searchColumns, AND'd with the rest of the where clause. */
  search?: string;
  /** Sort map, keys accept dot-paths into a relation (e.g. 'company.name') — TypeORM joins automatically. */
  sort?: Record<string, 'ASC' | 'DESC'>;
  skip?: number;
  limit?: number;
}

export interface FindOneOption<T = ObjectLiteral> extends FindManyOption<T> {
  isThrow?: boolean;
  message?: string;
}

export interface ExistsOption {
  throwCase?: ExistsThrowCase;
  message?: string;
}

export interface ExistsAllOption {
  throwCase?: ExistsAllThrowCase;
  message?: string;
}

/** Sets `target.a.b.c = value` given path `'a.b.c'`, merging into any existing nested object at each level. */
function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cursor = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    const existing = cursor[key];
    const next = typeof existing === 'object' && existing !== null ? (existing as Record<string, unknown>) : {};
    cursor[key] = next;
    cursor = next;
  });
}

export function methodFactory<T extends Identifiable<ID>, ID = string>(
  repo: Repository<T>,
  cls: ClsService,
  options: MethodOptions<T> = {},
) {
  const { tenantColumn, searchColumns } = options;
  const name = repo.metadata.name;

  function withTenant(where: FindOptionsWhere<T> = {} as FindOptionsWhere<T>): FindOptionsWhere<T> {
    if (tenantColumn && cls.isActive()) {
      const tenantId = cls.get(TENANT_CLS_KEY);
      if (tenantId !== undefined) {
        (where as Record<string, unknown>)[tenantColumn as string] = tenantId;
      }
    }
    return where;
  }

  function buildWhere(where: FindOptionsWhere<T> | undefined, search?: string): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const base = withTenant(where);
    if (!search || !searchColumns || searchColumns.length === 0) {
      return base;
    }
    return searchColumns.map((column) => ({ ...base, [column]: ILike(`%${search}%`) }) as FindOptionsWhere<T>);
  }

  /** Converts a flat, possibly dot-pathed sort map (e.g. `{ 'company.name': 'ASC' }`) into TypeORM's nested FindOptionsOrder shape. */
  function buildOrder(sort?: Record<string, 'ASC' | 'DESC'>): FindOptionsOrder<T> | undefined {
    if (!sort || Object.keys(sort).length === 0) {
      return undefined;
    }
    const order: Record<string, unknown> = {};
    Object.entries(sort).forEach(([path, direction]) => setNestedValue(order, path, direction));
    return order as FindOptionsOrder<T>;
  }

  function find(where: FindOptionsWhere<T> | undefined, opt: FindManyOption<T> & { idsOnly: true }): Promise<ID[]>;
  function find(where?: FindOptionsWhere<T>, opt?: FindManyOption<T>): Promise<T[]>;
  async function find(where?: FindOptionsWhere<T>, opt: FindManyOption<T> & { idsOnly?: boolean } = {}) {
    const finalWhere = buildWhere(where, opt.search);
    if (opt.idsOnly) {
      const rows = await repo.find({
        where: finalWhere,
        select: { id: true } as FindOptionsSelect<T>,
        order: buildOrder(opt.sort),
        skip: opt.skip,
        take: opt.limit,
      });
      return rows.map((row) => row.id);
    }
    return repo.find({
      where: finalWhere,
      relations: opt.relations,
      withDeleted: opt.withDeleted,
      select: opt.select,
      order: buildOrder(opt.sort),
      skip: opt.skip,
      take: opt.limit,
    });
  }

  async function count(where?: FindOptionsWhere<T>, opt: { search?: string } = {}): Promise<number> {
    return repo.count({ where: buildWhere(where, opt.search) });
  }

  function findOne(query: FindOptionsWhere<T>, opt: Omit<FindOneOption<T>, 'isThrow'> & { isThrow: true }): Promise<T>;
  function findOne(query?: FindOptionsWhere<T>, opt?: FindOneOption<T>): Promise<T | null>;
  async function findOne(query: FindOptionsWhere<T> = {} as FindOptionsWhere<T>, opt: FindOneOption<T> = {}) {
    const { isThrow, message, relations, withDeleted, select, sort } = opt;
    const data = await repo.findOne({ where: withTenant(query), relations, withDeleted, select, order: buildOrder(sort) });
    if (!data && isThrow) {
      throw new BadRequestException(message || `${name} with filter ${JSON.stringify(query)} not found`);
    }
    return data;
  }

  function findById(id: ID, opt: Omit<FindOneOption<T>, 'isThrow'> & { isThrow: true }): Promise<T>;
  function findById(id: ID, opt?: FindOneOption<T>): Promise<T | null>;
  async function findById(id: ID, opt: FindOneOption<T> = {}) {
    return findOne({ id } as FindOptionsWhere<T>, opt as { isThrow: true });
  }

  async function exists(where: FindOptionsWhere<T>, opt: ExistsOption = {}): Promise<boolean> {
    const { throwCase, message } = opt;
    const isExists = await repo.exists({ where: withTenant(where) });

    if (throwCase === 'IF_EXISTS' && isExists) {
      throw new BadRequestException(message || `${name} with filter ${JSON.stringify(where)} already exists`);
    }
    if (throwCase === 'IF_NOT_EXISTS' && !isExists) {
      throw new BadRequestException(message || `${name} with filter ${JSON.stringify(where)} not found`);
    }
    return isExists;
  }

  async function existsAll(
    ids: ID[],
    opt: ExistsAllOption = {},
    customQuery?: (ids: ID[]) => FindOptionsWhere<T>,
  ): Promise<{ isExistsOne: boolean; isExistsAll: boolean }> {
    const uniqueIds = Array.from(new Set(ids));
    const where = customQuery ? customQuery(uniqueIds) : withTenant({ id: In(uniqueIds) } as unknown as FindOptionsWhere<T>);
    const { throwCase, message } = opt;

    const total = await repo.count({ where });
    const isExistsOne = total > 0;
    const isExistsAll = total === uniqueIds.length;

    switch (throwCase) {
      case 'IF_ONE_EXISTS':
        if (isExistsOne) {
          throw new BadRequestException(message || `One of ${name} already exists`);
        }
        break;
      case 'IF_ONE_NOT_EXISTS':
        if (!isExistsAll) {
          throw new BadRequestException(message || `One of ${name} not found`);
        }
        break;
      case 'IF_ALL_EXISTS':
        if (isExistsAll) {
          throw new BadRequestException(message || `All ${name} already exist`);
        }
        break;
      case 'IF_ALL_NOT_EXISTS':
        if (!isExistsOne) {
          throw new BadRequestException(message || `All ${name} not found`);
        }
        break;
    }

    return { isExistsOne, isExistsAll };
  }

  function createInstance(input?: DeepPartial<T>): T {
    return input ? repo.create(input) : repo.create();
  }

  async function create(input: DeepPartial<T>): Promise<T> {
    const payload = withTenant({ ...input } as FindOptionsWhere<T>) as DeepPartial<T>;
    return repo.save(repo.create(payload));
  }

  async function update(where: FindOptionsWhere<T>, input: DeepPartial<T>): Promise<T | null> {
    await repo.update(withTenant(where), input as unknown as QueryDeepPartialEntity<T>);
    return findOne(where);
  }

  async function remove(where: FindOptionsWhere<T>): Promise<void> {
    await repo.delete(withTenant(where));
  }

  async function softDelete(where: FindOptionsWhere<T>): Promise<void> {
    await repo.softDelete(withTenant(where));
  }

  async function restore(where: FindOptionsWhere<T>): Promise<void> {
    await repo.restore(withTenant(where));
  }

  async function paginate(
    where: FindOptionsWhere<T> | undefined,
    { skip, limit, sort }: QueryParams,
    opt: { search?: string } = {},
  ): Promise<{ data: T[]; total: number }> {
    const [data, total] = await repo.findAndCount({
      where: buildWhere(where, opt.search),
      skip,
      take: limit,
      order: buildOrder(sort),
    });
    return { data, total };
  }

  function createQueryBuilder(alias: string = repo.metadata.name.toLowerCase()): SelectQueryBuilder<T> {
    const qb = repo.createQueryBuilder(alias);

    if (tenantColumn && cls.isActive()) {
      const tenantId = cls.get(TENANT_CLS_KEY);
      if (tenantId !== undefined) {
        qb.andWhere(`${alias}.${String(tenantColumn)} = :tenantId`, { tenantId });
      }
    }

    const deleteDateColumn = repo.metadata.deleteDateColumn;
    if (deleteDateColumn) {
      qb.andWhere(`${alias}.${deleteDateColumn.propertyName} IS NULL`);
    }

    return qb;
  }

  async function paginateQueryBuilder<R extends ObjectLiteral = T>(
    qb: SelectQueryBuilder<R>,
    { skip, limit, sort }: QueryParams,
    /** Prefix applied to each sort field, e.g. 'contact' turns `name` into `contact.name`. Omit if `sort` keys are already fully qualified. */
    alias?: string,
  ): Promise<{ data: R[]; total: number }> {
    Object.entries(sort ?? {}).forEach(([field, direction]) => {
      qb.addOrderBy(alias ? `${alias}.${field}` : field, direction);
    });
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total };
  }

  async function transaction<R>(callback: (manager: EntityManager) => Promise<R>): Promise<R> {
    return repo.manager.transaction(callback);
  }

  async function upsert(
    input: DeepPartial<T>,
    conflictPathsOrOptions: string[] | { conflictPaths: string[]; skipUpdateIfNoValuesChanged?: boolean },
  ) {
    const payload = withTenant({ ...input } as FindOptionsWhere<T>) as DeepPartial<T>;
    return repo.upsert(payload as unknown as QueryDeepPartialEntity<T>, conflictPathsOrOptions);
  }

  return {
    /**
     * @deprecated Bottom-tier escape hatch, for things createQueryBuilder can't do (raw SQL, manager-level ops).
     * Bypasses auto tenant-scoping AND soft-delete exclusion — calling repo.find/save/... directly skips both.
     * Prefer the methods above, or createQueryBuilder() for custom queries, before dropping down to this.
     */
    repo,
    createInstance,
    find,
    findOne,
    findById,
    count,
    exists,
    existsAll,
    create,
    update,
    delete: remove,
    softDelete,
    restore,
    paginate,
    createQueryBuilder,
    paginateQueryBuilder,
    transaction,
    upsert,
  };
}

export type Method<T extends Identifiable<ID>, ID = string> = ReturnType<typeof methodFactory<T, ID>>;
