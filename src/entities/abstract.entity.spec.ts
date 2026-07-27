import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { AbstractEntity } from './abstract.entity';

describe('AbstractEntity', () => {
  it('registers the expected audit + soft-delete columns', () => {
    const columns = getMetadataArgsStorage().columns.filter((column) => column.target === AbstractEntity);
    const byProperty = Object.fromEntries(columns.map((column) => [column.propertyName, column]));

    expect(Object.keys(byProperty).sort()).toEqual(['createdAt', 'createdBy', 'deletedAt', 'updatedAt', 'updatedBy']);
    expect(byProperty.createdAt.options.name).toBe('created_at');
    expect(byProperty.createdAt.options.default()).toBe('now()');
    expect(byProperty.createdBy.options.name).toBe('created_by');
    expect(byProperty.updatedAt.options.name).toBe('updated_at');
    expect(byProperty.updatedBy.options.name).toBe('updated_by');
    expect(byProperty.deletedAt.options.name).toBe('deleted_at');
  });

  it('does not declare an id column — each entity owns its own primary key', () => {
    const columns = getMetadataArgsStorage().columns.filter((column) => column.target === AbstractEntity);
    expect(columns.some((column) => column.propertyName === 'id')).toBe(false);
  });
});
