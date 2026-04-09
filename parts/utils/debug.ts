/**
 * Shared test debug utility.
 *
 * Activate by running tests with DEBUG_TEST=1, e.g.:
 *   DEBUG_TEST=1 npm test
 *   DEBUG_TEST=1 node --test --import tsx path/to/my.test.ts
 *
 * Usage:
 *   import { debugTest } from "../../parts/utils/debug.js";
 *
 *   debugTest("my label");
 *   debugTest("my label", "some string");
 *   debugTest("my label", { foo: 42 });
 *   debugTest("my label", myModel, myModel.serialize);
 */

const stringify = (data: unknown, serializer?: (d: unknown) => string): string => {
  if (typeof data === "string") return data;
  if (serializer) return serializer(data);
  return JSON.stringify(data, null, 2);
};

/**
 * Print a labelled debug message to stderr, controlled by the DEBUG_TEST
 * environment variable.  Has no effect unless DEBUG_TEST is set.
 *
 * @param label      - Short description of what is being printed.
 * @param data       - Optional payload: a string (printed as-is), or any
 *                     value serialized by `serializer` (if provided) or JSON.
 * @param serializer - Optional function to convert `data` to a string.
 *                     Use this to pass a domain-specific stringify, e.g. a
 *                     PGN serializer for a game model.
 */
export const debugTest = (
  label: string,
  data?: unknown,
  serializer?: (d: unknown) => string,
): void => {
  if (!process.env["DEBUG_TEST"]) return;
  process.stderr.write(`\n── ${label} ──\n`);
  if (data !== undefined) {
    process.stderr.write(stringify(data, serializer) + "\n");
  }
};
