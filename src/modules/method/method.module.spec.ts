import { FactoryProvider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { getMethodToken } from '../../decorators/method.decorator';
import { MethodModule } from './method.module';

class SampleEntity {
  id!: string;
  tenantId?: string;
}

describe('MethodModule.forFeature', () => {
  it('registers a METHOD_<Entity> provider per feature and imports TypeOrmModule.forFeature', () => {
    const dynamicModule = MethodModule.forFeature([{ entity: SampleEntity, tenantColumn: 'tenantId' }]);

    expect(dynamicModule.module).toBe(MethodModule);
    expect(dynamicModule.providers).toHaveLength(1);

    const provider = dynamicModule.providers?.[0] as FactoryProvider;
    expect(provider.provide).toBe(getMethodToken(SampleEntity));
    expect(provider.inject).toEqual([getRepositoryToken(SampleEntity), ClsService]);

    // exports the METHOD_<Entity> provider plus the underlying TypeOrmModule, so
    // @InjectRepository(Entity) still resolves downstream alongside @InjectMethod(Entity).
    expect(dynamicModule.exports).toEqual([...(dynamicModule.providers ?? []), dynamicModule.imports?.[0]]);
  });

  it('builds a Method<T> from the injected repository and cls when the factory runs', () => {
    const dynamicModule = MethodModule.forFeature([{ entity: SampleEntity }]);
    const provider = dynamicModule.providers?.[0] as FactoryProvider;

    const repo = { metadata: { name: 'SampleEntity' } } as unknown as Repository<SampleEntity>;
    const cls = { isActive: () => false } as unknown as ClsService;

    const method = provider.useFactory(repo, cls);
    expect(typeof method.find).toBe('function');
    expect(typeof method.paginate).toBe('function');
  });
});
