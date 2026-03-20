import test from "node:test";
import assert from "node:assert/strict";
import { createFileAdapter } from "../../../resource/adapters/file/file_adapter";

const SAMPLE_MULTI_GAME_PGN = `[Event "Game A"]
[White "Alpha"]
[Black "Beta"]
[Result "*"]

1. e4 e5 *

[Event "Game B"]
[White "Gamma"]
[Black "Delta"]
[Result "*"]

1. d4 d5 *`;

test("pgn-db adapter lists and loads games from one PGN file", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { __TAURI_INTERNALS__: {} };
  try {
    const adapter = createFileAdapter({
      invokeFn: async (command) => {
        assert.equal(command, "load_text_file");
        return SAMPLE_MULTI_GAME_PGN;
      },
    });

    const listed = await adapter.list({ kind: "file", locator: "/tmp/multi.pgn" });
    assert.equal(listed.entries.length, 2);
    assert.equal(listed.entries[0].gameRef.recordId, "1");
    assert.equal(listed.entries[1].gameRef.recordId, "2");
    assert.equal(listed.entries[0].metadata.White, "Alpha");
    assert.equal(listed.entries[0].metadata.Black, "Beta");
    assert.ok(Array.isArray(listed.entries[0].availableMetadataKeys));
    assert.ok(listed.entries[0].availableMetadataKeys.includes("Event"));

    const loadedSecond = await adapter.load({ kind: "file", locator: "/tmp/multi.pgn", recordId: "2" });
    assert.match(loadedSecond.pgnText, /\[Event "Game B"\]/);
    assert.match(loadedSecond.pgnText, /1\. d4 d5 \*/);
  } finally {
    if (typeof previousWindow === "undefined") {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

