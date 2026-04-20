/**
 * resource_domain_events — typed domain events for resource mutations.
 *
 * Integration API:
 * - `resourceDomainEvents.emit(event)` publishes a resource-domain fact.
 * - `resourceDomainEvents.subscribe(listener)` registers a listener and returns
 *   an unsubscribe function.
 *
 * Configuration API:
 * - No runtime configuration. The event hub is process-local and in-memory.
 *
 * Communication API:
 * - Pure TypeScript event channel with no DOM, React, or storage dependency.
 * - Event payloads are environment-agnostic and contain only domain data.
 */

export type ResourceRefIdentity = {
  kind: string;
  locator: string;
};

export type SourceRefIdentity = ResourceRefIdentity & {
  recordId?: string;
};

export type ResourceDomainEvent =
  | {
      type: "resource.gameCreated";
      resourceRef: ResourceRefIdentity;
      sourceRef: SourceRefIdentity;
      sessionId?: string;
    }
  | {
      type: "resource.gameSaved";
      resourceRef: ResourceRefIdentity;
      sourceRef: SourceRefIdentity;
      revisionToken?: string;
      sessionId?: string;
      wasCreate: boolean;
    }
  | {
      type: "resource.gameReordered";
      resourceRef: ResourceRefIdentity;
      sourceRef: SourceRefIdentity;
      neighborSourceRef: SourceRefIdentity;
    }
  | {
      type: "resource.gameDeleted";
      resourceRef: ResourceRefIdentity;
      sourceRef: SourceRefIdentity;
    }
  | {
      type: "resource.resourceChanged";
      resourceRef: ResourceRefIdentity;
      operation: "create" | "save" | "reorder" | "delete";
      sourceRef?: SourceRefIdentity;
    };

type ResourceDomainEventListener = (event: ResourceDomainEvent) => void;

type ResourceDomainEventHub = {
  emit: (event: ResourceDomainEvent) => void;
  subscribe: (listener: ResourceDomainEventListener) => () => void;
};

const createResourceDomainEventHub = (): ResourceDomainEventHub => {
  const listeners: Set<ResourceDomainEventListener> = new Set<ResourceDomainEventListener>();

  return {
    emit: (event: ResourceDomainEvent): void => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe: (listener: ResourceDomainEventListener): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
};

export const resourceDomainEvents: ResourceDomainEventHub = createResourceDomainEventHub();
