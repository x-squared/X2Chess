export type DbGateway = {
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
};
