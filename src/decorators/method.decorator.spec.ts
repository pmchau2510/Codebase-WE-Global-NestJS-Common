import 'reflect-metadata';
import { Inject } from '@nestjs/common';
import { EntitySchema } from 'typeorm';
import { getMethodToken, InjectMethod } from './method.decorator';

class SampleEntity {
  id!: string;
}

describe('getMethodToken', () => {
  it('builds the token from the class name', () => {
    expect(getMethodToken(SampleEntity)).toBe('METHOD_SampleEntity');
  });

  it('builds the token from an EntitySchema name', () => {
    const schema = new EntitySchema<{ id: string }>({ name: 'SampleEntity', columns: { id: { type: String, primary: true } } });
    expect(getMethodToken(schema)).toBe('METHOD_SampleEntity');
  });
});

describe('InjectMethod', () => {
  const SELF_DECLARED_DEPS_METADATA = 'self:paramtypes';

  it('applies the same metadata as @Inject(getMethodToken(entity))', () => {
    class WithManualInject {
      constructor(@Inject(getMethodToken(SampleEntity)) public readonly method: unknown) {}
    }
    class WithInjectMethod {
      constructor(@InjectMethod(SampleEntity) public readonly method: unknown) {}
    }

    const manualDeps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, WithManualInject);
    const injectMethodDeps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, WithInjectMethod);

    expect(injectMethodDeps).toEqual(manualDeps);
    expect(injectMethodDeps).toEqual([{ index: 0, param: 'METHOD_SampleEntity' }]);
  });
});
