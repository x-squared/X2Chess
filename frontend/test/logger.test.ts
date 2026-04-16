/**
 * Unit tests for `logger.ts`: message formatting and structured fields output.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { log } from "../src/logger.js";

test("log.info formats module and message without structured fields", () => {
  const originalInfo: typeof console.info = console.info;
  const captured: string[] = [];
  const toCapturedString = (value: unknown): string =>
    typeof value === "string" ? value : JSON.stringify(value);
  console.info = (message?: unknown): void => {
    captured.push(toCapturedString(message));
  };
  try {
    log.info("logger-test", "base message");
  } finally {
    console.info = originalInfo;
  }
  assert.equal(captured.length, 1);
  assert.equal(captured[0], "[INFO] [logger-test] base message");
});

test("log.info appends deterministic key-value fields", () => {
  const originalInfo: typeof console.info = console.info;
  const captured: string[] = [];
  const toCapturedString = (value: unknown): string =>
    typeof value === "string" ? value : JSON.stringify(value);
  console.info = (message?: unknown): void => {
    captured.push(toCapturedString(message));
  };
  try {
    log.info("logger-test", "opened", {
      zFlag: true,
      sessionId: "abc",
      count: 3,
      nullable: null,
    });
  } finally {
    console.info = originalInfo;
  }
  assert.equal(captured.length, 1);
  assert.equal(
    captured[0],
    '[INFO] [logger-test] opened | count=3 nullable=null sessionId="abc" zFlag=true',
  );
});
