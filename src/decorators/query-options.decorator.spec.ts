import { Request } from 'express';
import { extractQueryParams } from './query-options.decorator';

function query(q: Record<string, unknown>): Request['query'] {
  return q as unknown as Request['query'];
}

describe('extractQueryParams', () => {
  it('defaults to skip 0 and limit MAX_SAFE_INTEGER when nothing is provided', () => {
    expect(extractQueryParams(query({}))).toEqual({ skip: 0, limit: Number.MAX_SAFE_INTEGER, sort: undefined });
  });

  it('computes skip from page and limit', () => {
    expect(extractQueryParams(query({ page: '3', limit: '10' }))).toEqual({
      skip: 20,
      limit: 10,
      sort: undefined,
    });
  });

  it('uses skip directly when page is not provided', () => {
    expect(extractQueryParams(query({ skip: '5', limit: '10' }))).toEqual({
      skip: 5,
      limit: 10,
      sort: undefined,
    });
  });

  it('parses a single sort field', () => {
    expect(extractQueryParams(query({ sort: 'name:asc' })).sort).toEqual({ name: 'ASC' });
  });

  it('parses multiple sort fields', () => {
    expect(extractQueryParams(query({ sort: ['name:asc', 'age:desc'] })).sort).toEqual({
      name: 'ASC',
      age: 'DESC',
    });
  });

  it('ignores malformed sort entries', () => {
    expect(extractQueryParams(query({ sort: ['name', 'age:sideways'] })).sort).toEqual({});
  });
});
