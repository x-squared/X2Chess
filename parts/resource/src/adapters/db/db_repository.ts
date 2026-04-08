export type DbRepository = {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  execute: (sql: string, params?: unknown[]) => Promise<void>;
};
