export interface Identifiable<ID = string> {
  id: ID;
}

export interface MethodOptions<T> {
  /**
   * Column on T that stores the tenant id. Omit for entities/projects with no tenant concept —
   * every tenant-scoping code path in methodFactory is skipped entirely when this is unset.
   */
  tenantColumn?: keyof T;
  /**
   * Columns eligible for the `search` option on find()/paginate() — each match is OR'd together
   * (ILIKE `%search%`) and combined with the rest of the where clause via AND. Omit to disable `search`.
   */
  searchColumns?: (keyof T)[];
}
