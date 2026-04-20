import test from "node:test";
import assert from "node:assert/strict";
import { resourceDomainEvents } from "../../src/core/events/resource_domain_events.js";

test("resourceDomainEvents notifies subscribers with emitted payload", (): void => {
  let receivedType = "";
  let receivedLocator = "";
  const unsubscribe = resourceDomainEvents.subscribe((event): void => {
    receivedType = event.type;
    if (event.type === "resource.resourceChanged") {
      receivedLocator = event.resourceRef.locator;
    }
  });
  resourceDomainEvents.emit({
    type: "resource.resourceChanged",
    resourceRef: { kind: "directory", locator: "/tmp/games" },
    operation: "save",
  });
  unsubscribe();
  assert.equal(receivedType, "resource.resourceChanged");
  assert.equal(receivedLocator, "/tmp/games");
});

test("resourceDomainEvents unsubscribe stops future notifications", (): void => {
  let callCount = 0;
  const unsubscribe = resourceDomainEvents.subscribe((): void => {
    callCount += 1;
  });
  resourceDomainEvents.emit({
    type: "resource.resourceChanged",
    resourceRef: { kind: "directory", locator: "/tmp/games" },
    operation: "save",
  });
  unsubscribe();
  resourceDomainEvents.emit({
    type: "resource.resourceChanged",
    resourceRef: { kind: "directory", locator: "/tmp/games" },
    operation: "save",
  });
  assert.equal(callCount, 1);
});
