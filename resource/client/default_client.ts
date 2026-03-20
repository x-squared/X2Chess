import { createDefaultAdapters } from "../adapters";
import { createResourceClient, type ResourceClient } from "./api";

/**
 * Default resource client factory.
 *
 * Integration API:
 * - Primary export: `createDefaultResourceClient`.
 *
 * Configuration API:
 * - Uses `createDefaultAdapters()`; no caller options.
 *
 * Communication API:
 * - Constructs a client backed by default file/directory/db adapters.
 */
export const createDefaultResourceClient = (): ResourceClient => createResourceClient(createDefaultAdapters());
