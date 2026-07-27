import { Inject } from '@nestjs/common';
import { EntitySchema, ObjectType } from 'typeorm';

export function getMethodToken<T>(entity: ObjectType<T> | EntitySchema<T>): string {
  const name = typeof entity === 'function' ? entity.name : entity.options.name;
  return `METHOD_${name}`;
}

export function InjectMethod<T>(entity: ObjectType<T> | EntitySchema<T>): ParameterDecorator & PropertyDecorator {
  return Inject(getMethodToken(entity));
}
