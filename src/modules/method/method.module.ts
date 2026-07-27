import { DynamicModule, Module, Provider } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { EntitySchema, ObjectType, Repository } from 'typeorm';
import { getMethodToken } from '../../decorators/method.decorator';
import { methodFactory } from './method-factory';
import { Identifiable } from './types';

export interface MethodFeature<T extends Identifiable = Identifiable> {
  entity: ObjectType<T> | EntitySchema<T>;
  /** Column name on T that stores the tenant id. Omit for entities/projects with no tenant concept. */
  tenantColumn?: string;
  /** Columns eligible for the `search` option on find()/paginate(). Omit to disable `search`. */
  searchColumns?: string[];
}

@Module({})
export class MethodModule {
  static forFeature(features: MethodFeature[]): DynamicModule {
    const providers: Provider[] = features.map(({ entity, tenantColumn, searchColumns }) => ({
      provide: getMethodToken(entity),
      useFactory: (repo: Repository<Identifiable>, cls: ClsService) =>
        methodFactory(repo, cls, {
          tenantColumn: tenantColumn as keyof Identifiable | undefined,
          searchColumns: searchColumns as (keyof Identifiable)[] | undefined,
        }),
      inject: [getRepositoryToken(entity), ClsService],
    }));

    const typeOrmModule = TypeOrmModule.forFeature(features.map((feature) => feature.entity));

    return {
      module: MethodModule,
      imports: [typeOrmModule],
      providers,
      // Re-exports typeOrmModule too, so @InjectRepository(Entity) still works downstream
      // for callers who need the raw repository alongside (or instead of) @InjectMethod(Entity).
      exports: [...providers, typeOrmModule],
    };
  }
}
