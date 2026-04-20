import test from "node:test";
import assert from "node:assert/strict";
import { shouldTriggerLiveRefresh } from "../../../../src/features/resources/services/resource_live_refresh.js";

test("shouldTriggerLiveRefresh returns true for valid live-refresh state", (): void => {
  const shouldRefresh: boolean = shouldTriggerLiveRefresh({
    liveRefreshEnabled: true,
    hasSearched: true,
    isLoading: false,
    hasMatchingResourceRef: true,
  });
  assert.equal(shouldRefresh, true);
});

test("shouldTriggerLiveRefresh returns false when live refresh disabled", (): void => {
  const shouldRefresh: boolean = shouldTriggerLiveRefresh({
    liveRefreshEnabled: false,
    hasSearched: true,
    isLoading: false,
    hasMatchingResourceRef: true,
  });
  assert.equal(shouldRefresh, false);
});

test("shouldTriggerLiveRefresh returns false when query is blank", (): void => {
  const shouldRefresh: boolean = shouldTriggerLiveRefresh({
    liveRefreshEnabled: true,
    hasSearched: true,
    isLoading: false,
    hasMatchingResourceRef: true,
    queryText: "   ",
  });
  assert.equal(shouldRefresh, false);
});

test("shouldTriggerLiveRefresh returns false while loading", (): void => {
  const shouldRefresh: boolean = shouldTriggerLiveRefresh({
    liveRefreshEnabled: true,
    hasSearched: true,
    isLoading: true,
    hasMatchingResourceRef: true,
  });
  assert.equal(shouldRefresh, false);
});
