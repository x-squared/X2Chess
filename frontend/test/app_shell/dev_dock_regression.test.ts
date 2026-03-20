import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialAppState } from "../../src/app_shell/app_state.js";

test("developer dock starts closed in initial app state", () => {
  const state = createInitialAppState(() => ({}));
  assert.equal(state.isDevDockOpen, false);
});

test("developer dock hidden attribute is enforced by CSS", async () => {
  const cssPath = new URL("../../src/styles.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.developer-dock\[hidden\]\s*\{\s*display:\s*none\s*!important;/m);
});

test("resource viewer height has stable default in initial state", () => {
  const state = createInitialAppState(() => ({}));
  assert.equal(state.resourceViewerHeightPx, 260);
});

test("resource viewer uses CSS variable height", async () => {
  const cssPath = new URL("../../src/styles.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--resource-viewer-height:\s*260px;/);
  assert.match(css, /\.resource-table-wrap\s*\{[\s\S]*height:\s*var\(--resource-viewer-height\);/m);
});

test("board column width has stable default in initial state", () => {
  const state = createInitialAppState(() => ({}));
  assert.equal(state.boardColumnWidthPx, 520);
});

test("board/editor layout uses configurable board column width", async () => {
  const cssPath = new URL("../../src/styles.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--board-column-width:\s*520px;/);
  assert.match(css, /\.board-editor-box\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*var\(--board-column-width\)\)\s*14px\s*minmax\(320px,\s*1fr\);/m);
});
