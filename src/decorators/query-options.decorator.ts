import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface QueryParams {
  skip: number;
  limit: number;
  sort?: Record<string, 'ASC' | 'DESC'>;
}

const ORDER_BY: Record<string, 'ASC' | 'DESC'> = {
  ASC: 'ASC',
  DESC: 'DESC',
};

export function extractQueryParams(query: Request['query']): QueryParams {
  const page = !Number.isNaN(Number(query.page)) ? Number(query.page) : undefined;
  let skip = !Number.isNaN(Number(query.skip)) ? Number(query.skip) : undefined;
  const limit = !Number.isNaN(Number(query.limit)) ? Number(query.limit) : undefined;

  if (page !== undefined && limit !== undefined) {
    skip = (page - 1) * limit;
  }

  let sort = query.sort;
  if (typeof sort === 'string') {
    sort = [sort];
  }

  let mapSort: Record<string, 'ASC' | 'DESC'> | undefined;
  if (Array.isArray(sort) && sort.length > 0) {
    mapSort = {};
    for (const item of sort) {
      const [field, direction] = String(item).split(':');
      if (!field || !direction) {
        continue;
      }
      const normalized = ORDER_BY[direction.toUpperCase()];
      if (normalized) {
        mapSort[field] = normalized;
      }
    }
  }

  return {
    skip: skip || 0,
    limit: limit || Number.MAX_SAFE_INTEGER,
    sort: mapSort,
  };
}

export const QueryOptions = createParamDecorator((_: unknown, ctx: ExecutionContext): QueryParams => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return extractQueryParams(req.query);
});
