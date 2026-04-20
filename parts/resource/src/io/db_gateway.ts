export type DbGateway = {
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  /**
   * Run `fn` inside a single database transaction.
   * Commits on success; rolls back and re-throws on any error.
   */
  transaction: (fn: (db: DbGateway) => Promise<void>) => Promise<void>;
};
