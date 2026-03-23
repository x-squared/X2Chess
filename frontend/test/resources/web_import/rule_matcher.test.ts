import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUrl, matchRule, expandTemplate } from "../../../src/resources/web_import/rule_matcher";
import { BUILT_IN_RULES } from "../../../src/resources/web_import/built_in_rules";
import type { WebImportRule } from "../../../src/resources/web_import/web_import_types";

// ── isUrl ─────────────────────────────────────────────────────────────────────

describe("isUrl", () => {
  it("returns true for http URL", () => {
    assert.equal(isUrl("http://example.com/foo"), true);
  });
  it("returns true for https URL", () => {
    assert.equal(isUrl("https://lichess.org/abc12345"), true);
  });
  it("returns false for plain PGN text", () => {
    assert.equal(isUrl("[Event \"?\"]"), false);
  });
  it("returns false for a FEN string", () => {
    assert.equal(isUrl("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), false);
  });
  it("strips leading whitespace before testing", () => {
    assert.equal(isUrl("  https://lichess.org/abc12345"), true);
  });
});

// ── expandTemplate ────────────────────────────────────────────────────────────

describe("expandTemplate", () => {
  it("substitutes $1", () => {
    assert.equal(
      expandTemplate("https://lichess.org/game/export/$1", ["full", "abcd1234"]),
      "https://lichess.org/game/export/abcd1234",
    );
  });
  it("substitutes $1 and $3 (skipping $2)", () => {
    assert.equal(
      expandTemplate("https://api.chess.com/pub/game/$3", ["full", "live", "daily", "999"]),
      "https://api.chess.com/pub/game/999",
    );
  });
  it("replaces missing capture group with empty string", () => {
    assert.equal(expandTemplate("prefix/$5/suffix", ["full"]), "prefix//suffix");
  });
  it("does not substitute $0", () => {
    assert.equal(expandTemplate("test/$0/end", ["full", "cap"]), "test/$0/end");
  });
});

// ── matchRule — built-in rules ────────────────────────────────────────────────

describe("matchRule — built-in rules", () => {
  it("matches lichess-game URL", () => {
    const result = matchRule("https://lichess.org/abcd1234", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "lichess-game");
    assert.equal(result.captures[1], "abcd1234");
  });

  it("matches lichess-puzzle URL", () => {
    const result = matchRule("https://lichess.org/training/Xyz9ABC", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "lichess-puzzle");
    assert.equal(result.captures[1], "Xyz9ABC");
  });

  it("matches chess.com daily puzzle URL", () => {
    const result = matchRule("https://www.chess.com/puzzles", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "chessdotcom-daily-puzzle");
  });

  it("matches chess.com game URL", () => {
    const result = matchRule("https://www.chess.com/game/live/12345678", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "chessdotcom-game");
    assert.equal(result.captures[3], "12345678");
  });

  it("matches direct PGN URL", () => {
    const result = matchRule("https://example.com/games/myfile.pgn", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "direct-pgn");
  });

  it("matches direct PGN URL with query string", () => {
    const result = matchRule("https://example.com/games/myfile.pgn?download=1", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "direct-pgn");
  });

  it("matches chesspuzzle.net URL", () => {
    const result = matchRule("https://chesspuzzle.net/Puzzle/12345", BUILT_IN_RULES);
    assert.ok(result, "should match");
    assert.equal(result.rule.id, "chesspuzzle-net");
    assert.equal(result.captures[1], "12345");
  });

  it("returns null for unrecognised URL", () => {
    const result = matchRule("https://unknown-chess-site.example.com/puzzle/1", BUILT_IN_RULES);
    assert.equal(result, null);
  });
});

// ── matchRule — error handling ────────────────────────────────────────────────

describe("matchRule — invalid pattern", () => {
  it("skips a rule with an invalid regex pattern and continues to the next", () => {
    const rules: WebImportRule[] = [
      {
        id: "broken",
        label: "Broken",
        urlPattern: "[invalid((",
        strategy: "api",
      },
      {
        id: "working",
        label: "Working",
        urlPattern: "example\\.com",
        strategy: "direct",
        responseType: "pgn",
      },
    ];
    const result = matchRule("https://example.com/game.pgn", rules);
    assert.ok(result, "should fall through to the working rule");
    assert.equal(result.rule.id, "working");
  });
});
