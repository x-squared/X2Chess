import test from "node:test";
import assert from "node:assert/strict";
import { createIngressEventHandlers } from "../../src/game_sessions/ingress_handlers.js";

test("dragover accepts drags exposing Files type without file list", () => {
  const { handleDragOver } = createIngressEventHandlers({
    isLikelyPgnText: () => true,
    openGameFromIncomingText: () => {},
  });

  let prevented = false;
  handleDragOver({
    dataTransfer: { files: [], types: ["Files"] },
    preventDefault: () => { prevented = true; },
  } as unknown as Event);

  assert.equal(prevented, true);
});

test("drop reads pgn files from DataTransferItem fallback", async () => {
  const opened: Array<{ text: string; options: unknown }> = [];
  const { handleDrop } = createIngressEventHandlers({
    isLikelyPgnText: (value) => value.includes("1. e4"),
    openGameFromIncomingText: (text, options) => { opened.push({ text, options }); },
  });

  const file = {
    name: "test-game.pgn",
    type: "",
    text: async () => "[Event \"Test\"]\n\n1. e4 e5 *",
  };
  let prevented = false;
  handleDrop({
    dataTransfer: {
      files: [],
      items: [{ kind: "file", getAsFile: () => file }],
      getData: () => "",
    },
    preventDefault: () => { prevented = true; },
  } as unknown as Event);

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(prevented, true);
  assert.equal(opened.length, 1);
  assert.equal((opened[0].options as { preferredTitle: string }).preferredTitle, "test-game");
  assert.equal((opened[0].options as { preferInsertIntoActiveResource: boolean }).preferInsertIntoActiveResource, false);
});

test("drop derives source and resource refs from dropped file path", async () => {
  const opened: Array<{ text: string; options: unknown }> = [];
  const { handleDrop } = createIngressEventHandlers({
    isLikelyPgnText: () => true,
    openGameFromIncomingText: (text, options) => { opened.push({ text, options }); },
  });

  const file = {
    name: "from-drop.pgn",
    path: "/tmp/chess/inbox/from-drop.pgn",
    type: "",
    text: async () => "[Event \"Drop\"]\n\n1. d4 d5 *",
  };
  handleDrop({
    dataTransfer: {
      files: [file],
      items: [],
      getData: () => "",
    },
    preventDefault: () => {},
  } as unknown as Event);

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(opened.length, 1);
  assert.deepEqual((opened[0].options as { sourceRef: unknown }).sourceRef, {
    kind: "file",
    locator: "/tmp/chess/inbox",
    recordId: "from-drop.pgn",
  });
  assert.deepEqual((opened[0].options as { resourceRef: unknown }).resourceRef, {
    kind: "file",
    locator: "/tmp/chess/inbox",
  });
});

test("paste of https URL calls resolveUrl instead of openGameFromIncomingText", async () => {
  const opened: string[] = [];
  const resolved: string[] = [];

  const { handlePaste } = createIngressEventHandlers({
    isLikelyPgnText: () => false,
    openGameFromIncomingText: (text) => { opened.push(text); },
    resolveUrl: async (url) => { resolved.push(url); },
  });

  const pasteEvent = {
    target: { tagName: "DIV", isContentEditable: false },
    clipboardData: { getData: () => "https://lichess.org/abcd1234" },
  } as unknown as ClipboardEvent;

  handlePaste(pasteEvent);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(opened.length, 0, "should NOT call openGameFromIncomingText for a URL");
  assert.equal(resolved.length, 1, "should call resolveUrl once");
  assert.equal(resolved[0], "https://lichess.org/abcd1234");
});

test("drag overlay visibility toggles during drag lifecycle", () => {
  const visibility: boolean[] = [];
  const { handleDragEnter, handleDrop } = createIngressEventHandlers({
    isLikelyPgnText: () => true,
    openGameFromIncomingText: () => {},
    setDropOverlayVisible: (isVisible) => { visibility.push(isVisible); },
  });

  handleDragEnter({
    dataTransfer: { files: [], types: ["Files"] },
    preventDefault: () => {},
  } as unknown as Event);

  handleDrop({
    dataTransfer: { files: [], items: [], getData: () => "" },
    preventDefault: () => {},
  } as unknown as Event);

  assert.deepEqual(visibility, [true, false]);
});
