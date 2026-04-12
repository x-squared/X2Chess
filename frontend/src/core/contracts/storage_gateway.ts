export type StorageGateway = {
  exportSnapshot(data: Record<string, string>): Promise<void>;
  importSnapshot(): Promise<Record<string, string> | null>;
};
