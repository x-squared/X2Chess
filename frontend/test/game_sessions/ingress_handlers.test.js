import test from "node:test";
import assert from "node:assert/strict";
import { createGameIngressHandlers } from "../../src/game_sessions/ingress_handlers.js";

const withWindowStub = async (run) => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    addEventListener: () => {},
  };
  try {
    await run();
  } finally {
    globalThis.window = previousWindow;
  }
};

const createMockPanel = () => {
  const listeners = new Map();
  return {
    addEventListener: (name, handler) => {
      listeners.set(name, handler);
    },
    emit: (name, event) => {
      const handler = listeners.get(name);
      if (!handler) throw new Error(`missing listener: ${name}`);
      handler(event);
    },
  };
};

test("dragover accepts drags exposing Files type without file list", () => {
  return withWindowStub(async () => {
    const panel = createMockPanel();
    const handlers = createGameIngressHandlers({
      appPanelEl: panel,
      isLikelyPgnText: () => true,
      openGameFromIncomingText: () => true,
    });
    handlers.bindEvents();

    let prevented = false;
    panel.emit("dragover", {
      dataTransfer: {
        files: [],
        types: ["Files"],
      },
      preventDefault: () => {
        prevented = true;
      },
    });

    assert.equal(prevented, true);
  });
});

test("drop reads pgn files from DataTransferItem fallback", async () => {
  await withWindowStub(async () => {
    const panel = createMockPanel();
    const opened = [];
    const handlers = createGameIngressHandlers({
      appPanelEl: panel,
      isLikelyPgnText: (value) => value.includes("1. e4"),
      openGameFromIncomingText: (text, options) => {
        opened.push({ text, options });
        return true;
      },
    });
    handlers.bindEvents();

    const file = {
      name: "test-game.pgn",
      type: "",
      text: async () => "[Event \"Test\"]\n\n1. e4 e5 *",
    };
    let prevented = false;
    panel.emit("drop", {
      dataTransfer: {
        files: [],
        items: [{
          kind: "file",
          getAsFile: () => file,
        }],
        getData: () => "",
      },
      preventDefault: () => {
        prevented = true;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(prevented, true);
    assert.equal(opened.length, 1);
    assert.equal(opened[0].options.preferredTitle, "test-game");
    assert.equal(opened[0].options.preferInsertIntoActiveResource, false);
  });
});

test("drop derives source and resource refs from dropped file path", async () => {
  await withWindowStub(async () => {
    const panel = createMockPanel();
    const opened = [];
    const handlers = createGameIngressHandlers({
      appPanelEl: panel,
      isLikelyPgnText: () => true,
      openGameFromIncomingText: (text, options) => {
        opened.push({ text, options });
        return true;
      },
    });
    handlers.bindEvents();
    const file = {
      name: "from-drop.pgn",
      path: "/tmp/chess/inbox/from-drop.pgn",
      type: "",
      text: async () => "[Event \"Drop\"]\n\n1. d4 d5 *",
    };
    panel.emit("drop", {
      dataTransfer: {
        files: [file],
        items: [],
        getData: () => "",
      },
      preventDefault: () => {},
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(opened.length, 1);
    assert.deepEqual(opened[0].options.sourceRef, {
      kind: "file",
      locator: "/tmp/chess/inbox",
      recordId: "from-drop.pgn",
    });
    assert.deepEqual(opened[0].options.resourceRef, {
      kind: "file",
      locator: "/tmp/chess/inbox",
    });
  });
});

test("drag overlay visibility toggles during drag lifecycle", async () => {
  await withWindowStub(async () => {
    const panel = createMockPanel();
    const visibility = [];
    const handlers = createGameIngressHandlers({
      appPanelEl: panel,
      isLikelyPgnText: () => true,
      setDropOverlayVisible: (isVisible) => {
        visibility.push(isVisible);
      },
      openGameFromIncomingText: () => true,
    });
    handlers.bindEvents();

    panel.emit("dragenter", {
      dataTransfer: {
        files: [],
        types: ["Files"],
      },
      preventDefault: () => {},
    });
    panel.emit("drop", {
      dataTransfer: {
        files: [],
        items: [],
        getData: () => "",
      },
      preventDefault: () => {},
    });
    assert.deepEqual(visibility, [true, false]);
  });
});
