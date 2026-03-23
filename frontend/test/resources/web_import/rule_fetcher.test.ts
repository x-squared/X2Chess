import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fetchFromRule } from "../../../src/resources/web_import/rule_fetcher";
import type { WebImportRule } from "../../../src/resources/web_import/web_import_types";

// ── Helpers ───────────────────────────────────────────────────────────────────

type MockResponseInit = {
  ok?: boolean;
  status?: number;
  body?: string;
  json?: unknown;
};

const makeFetchMock = (init: MockResponseInit) => {
  const { ok = true, body = "", json: jsonBody } = init;
  return mock.fn((): Promise<Response> =>
    Promise.resolve({
      ok,
      status: init.status ?? (ok ? 200 : 400),
      text: (): Promise<string> => Promise.resolve(jsonBody !== undefined ? JSON.stringify(jsonBody) : body),
      json: (): Promise<unknown> => Promise.resolve(jsonBody),
    } as unknown as Response),
  );
};

// Inject the mock into the global fetch before each test group.
// node:test does not have beforeAll, so we restore after each test manually.

// ── direct strategy ───────────────────────────────────────────────────────────

describe("fetchFromRule — strategy: direct", () => {
  const rule: WebImportRule = {
    id: "direct-pgn",
    label: "Direct PGN",
    urlPattern: "\\.pgn$",
    strategy: "direct",
    responseType: "pgn",
    fetchUrl: "https://example.com/game.pgn",
  };

  beforeEach(() => {
    // Reset mock between tests (mock.fn is stateful).
    mock.restoreAll();
  });

  it("returns pgn result for a plain text body", async () => {
    const pgn = "[Event \"Test\"]\n1. e4 e5 *";
    global.fetch = makeFetchMock({ body: pgn }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["game.pgn"]);
    assert.ok(result, "should return a result");
    assert.equal(result.kind, "pgn");
    assert.equal(result.value.trim(), pgn);
    mock.restoreAll();
  });

  it("returns null when response is not ok", async () => {
    global.fetch = makeFetchMock({ ok: false, status: 404 }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["game.pgn"]);
    assert.equal(result, null);
    mock.restoreAll();
  });

  it("returns null when body is empty", async () => {
    global.fetch = makeFetchMock({ body: "   " }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["game.pgn"]);
    assert.equal(result, null);
    mock.restoreAll();
  });
});

// ── json.pgn strategy ─────────────────────────────────────────────────────────

describe("fetchFromRule — responseType: json.pgn", () => {
  beforeEach(() => mock.restoreAll());

  it("extracts pgn from a top-level field", async () => {
    const rule: WebImportRule = {
      id: "chessdotcom-game",
      label: "Chess.com game",
      urlPattern: "chess\\.com/game",
      strategy: "api",
      fetchUrl: "https://api.chess.com/pub/game/$3",
      responseType: "json.pgn",
      fieldPaths: { pgn: "pgn" },
    };
    global.fetch = makeFetchMock({ json: { pgn: "[Event \"Live\"]\n1. d4 *" } }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["full", "live", "daily", "99"]);
    assert.ok(result);
    assert.equal(result.kind, "pgn");
    assert.equal(result.value, "[Event \"Live\"]\n1. d4 *");
    mock.restoreAll();
  });

  it("extracts pgn from a nested dot-path field", async () => {
    const rule: WebImportRule = {
      id: "lichess-puzzle",
      label: "Lichess puzzle",
      urlPattern: "lichess\\.org/training",
      strategy: "api",
      fetchUrl: "https://lichess.org/api/puzzle/$1",
      responseType: "json.pgn",
      fieldPaths: { pgn: "game.pgn" },
    };
    global.fetch = makeFetchMock({
      json: { game: { pgn: "[Event \"Puzzle\"]\n1. e4 e5 2. Nf3 *" } },
    }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["full", "Xyz9"]);
    assert.ok(result);
    assert.equal(result.kind, "pgn");
    mock.restoreAll();
  });

  it("returns null when the dot-path field is absent", async () => {
    const rule: WebImportRule = {
      id: "test",
      label: "Test",
      urlPattern: "example\\.com",
      strategy: "api",
      fetchUrl: "https://example.com/$1",
      responseType: "json.pgn",
      fieldPaths: { pgn: "data.pgn" },
    };
    global.fetch = makeFetchMock({ json: { data: {} } }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["full", "123"]);
    assert.equal(result, null);
    mock.restoreAll();
  });
});

// ── json.fen+pgn strategy ─────────────────────────────────────────────────────

describe("fetchFromRule — responseType: json.fen+pgn", () => {
  beforeEach(() => mock.restoreAll());

  const rule: WebImportRule = {
    id: "chessdotcom-daily-puzzle",
    label: "Chess.com daily puzzle",
    urlPattern: "chess\\.com/puzzles",
    strategy: "api",
    fetchUrl: "https://api.chess.com/pub/puzzle",
    responseType: "json.fen+pgn",
    fieldPaths: { title: "title" },
  };

  it("prefers pgn over fen", async () => {
    global.fetch = makeFetchMock({
      json: {
        pgn: "[Event \"Daily\"]\n1. e4 *",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        title: "Puzzle of the Day",
      },
    }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["full", "www.chess.com"]);
    assert.ok(result);
    assert.equal(result.kind, "pgn");
    assert.equal(result.title, "Puzzle of the Day");
    mock.restoreAll();
  });

  it("falls back to fen when pgn is absent", async () => {
    global.fetch = makeFetchMock({
      json: {
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        title: "Puzzle",
      },
    }) as unknown as typeof fetch;
    const result = await fetchFromRule(rule, ["full"]);
    assert.ok(result);
    assert.equal(result.kind, "fen");
    mock.restoreAll();
  });
});

// ── unsupported strategies ────────────────────────────────────────────────────

describe("fetchFromRule — unsupported strategies", () => {
  it("returns null for native-html (Tier 2, not yet implemented)", async () => {
    const rule: WebImportRule = {
      id: "chesspuzzle-net",
      label: "chesspuzzle.net",
      urlPattern: "chesspuzzle\\.net/Puzzle",
      strategy: "native-html",
      fetchUrl: "https://chesspuzzle.net/Puzzle/$1",
      responseType: "html.extract",
    };
    const result = await fetchFromRule(rule, ["full", "12345"]);
    assert.equal(result, null);
  });

  it("returns null for webview (Tier 3, not yet implemented)", async () => {
    const rule: WebImportRule = {
      id: "test-webview",
      label: "Test WebView",
      urlPattern: "example\\.com",
      strategy: "webview",
      captureScript: "document.querySelector('[data-fen]')?.getAttribute('data-fen')",
    };
    const result = await fetchFromRule(rule, ["full"]);
    assert.equal(result, null);
  });
});

// ── network error ─────────────────────────────────────────────────────────────

describe("fetchFromRule — network error", () => {
  it("returns null when fetch throws", async () => {
    global.fetch = mock.fn((): Promise<never> =>
      Promise.reject(new Error("Network failure")),
    ) as unknown as typeof fetch;
    const rule: WebImportRule = {
      id: "direct-pgn",
      label: "Direct PGN",
      urlPattern: "\\.pgn$",
      strategy: "direct",
      responseType: "pgn",
      fetchUrl: "https://example.com/game.pgn",
    };
    const result = await fetchFromRule(rule, ["game.pgn"]);
    assert.equal(result, null);
    mock.restoreAll();
  });
});
