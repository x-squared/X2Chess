import test from "node:test";
import assert from "node:assert/strict";
import { parseTrainTag } from "../../src/features/resources/services/train_tag_parser.js";

test("parseTrainTag — returns null when no tag present", () => {
  assert.equal(parseTrainTag("A normal comment with no tag."), null);
});

test("parseTrainTag — returns null for empty comment", () => {
  assert.equal(parseTrainTag(""), null);
});

test("parseTrainTag — parses accept list", () => {
  const tag = parseTrainTag('[%train accept="e2e4,d2d4"]');
  assert.deepEqual(tag?.accept, ["e2e4", "d2d4"]);
  assert.deepEqual(tag?.reject, []);
});

test("parseTrainTag — parses reject list", () => {
  const tag = parseTrainTag('[%train reject="g1h3"]');
  assert.deepEqual(tag?.reject, ["g1h3"]);
  assert.deepEqual(tag?.accept, []);
});

test("parseTrainTag — parses hint text", () => {
  const tag = parseTrainTag('[%train hint="Activate the knight"]');
  assert.equal(tag?.hint, "Activate the knight");
});

test("parseTrainTag — parses all three fields", () => {
  const tag = parseTrainTag('[%train accept="g1f3,d1h5" reject="g1h3" hint="Control the center"]');
  assert.deepEqual(tag?.accept, ["g1f3", "d1h5"]);
  assert.deepEqual(tag?.reject, ["g1h3"]);
  assert.equal(tag?.hint, "Control the center");
});

test("parseTrainTag — trims whitespace from UCI entries", () => {
  const tag = parseTrainTag('[%train accept=" e2e4 , d2d4 "]');
  assert.deepEqual(tag?.accept, ["e2e4", "d2d4"]);
});

test("parseTrainTag — empty tag returns empty lists and no hint", () => {
  const tag = parseTrainTag("[%train]");
  assert.ok(tag !== null);
  assert.deepEqual(tag.accept, []);
  assert.deepEqual(tag.reject, []);
  assert.equal(tag.hint, undefined);
});

test("parseTrainTag — tag embedded in surrounding comment text", () => {
  const tag = parseTrainTag("Key position. [%train accept=\"e2e4\"] White must centralise.");
  assert.deepEqual(tag?.accept, ["e2e4"]);
});

test("parseTrainTag — filters empty strings from single-item list with trailing comma", () => {
  const tag = parseTrainTag('[%train accept="e2e4,"]');
  assert.deepEqual(tag?.accept, ["e2e4"]);
});
