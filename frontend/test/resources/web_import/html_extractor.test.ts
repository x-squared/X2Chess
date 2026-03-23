import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFromHtml } from "../../../src/resources/web_import/html_extractor";
import type { HtmlExtractRule } from "../../../src/resources/web_import/web_import_types";

// ── css-attr ──────────────────────────────────────────────────────────────────

describe("extractFromHtml — css-attr", () => {
  const rules: HtmlExtractRule[] = [
    { type: "css-attr", selector: "[data-fen]", attribute: "data-fen" },
  ];

  it("extracts attribute value with double quotes", () => {
    const html = `<div class="board" data-fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"></div>`;
    const result = extractFromHtml(html, rules);
    assert.equal(result, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
  });

  it("extracts attribute value with single quotes", () => {
    const html = `<div data-fen='8/8/8/4k3/8/4K3/8/8 w - - 0 1'></div>`;
    const result = extractFromHtml(html, rules);
    assert.equal(result, "8/8/8/4k3/8/4K3/8/8 w - - 0 1");
  });

  it("returns null when attribute is absent", () => {
    const html = `<div class="board"></div>`;
    assert.equal(extractFromHtml(html, rules), null);
  });

  it("returns null when attribute value is very short (< 4 chars)", () => {
    const html = `<div data-fen="ab"></div>`;
    assert.equal(extractFromHtml(html, rules), null);
  });
});

// ── script-regex ──────────────────────────────────────────────────────────────

describe("extractFromHtml — script-regex", () => {
  it("extracts FEN from a script tag with var assignment", () => {
    const html = `
      <html><body>
      <div class="puzzle"></div>
      <script type="text/javascript">
        var fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        var moves = ["e2e4"];
      </script>
      </body></html>
    `;
    const rules: HtmlExtractRule[] = [
      { type: "script-regex", pattern: "fen\\s*=\\s*['\"]([^'\"]{10,})['\"]" },
    ];
    const result = extractFromHtml(html, rules);
    assert.equal(result, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  });

  it("extracts FEN from JSON embedded in a script tag", () => {
    const html = `
      <script>
        window.__PUZZLE__ = {"id":123,"fen":"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4","solution":"d2d3"};
      </script>
    `;
    const rules: HtmlExtractRule[] = [
      { type: "script-regex", pattern: "\"fen\"\\s*:\\s*\"([^\"]{10,})\"" },
    ];
    const result = extractFromHtml(html, rules);
    assert.equal(result, "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
  });

  it("returns null when the pattern does not match any script", () => {
    const html = `<script>console.log("hello")</script>`;
    const rules: HtmlExtractRule[] = [
      { type: "script-regex", pattern: "fen\\s*=\\s*['\"]([^'\"]{10,})['\"]" },
    ];
    assert.equal(extractFromHtml(html, rules), null);
  });

  it("returns null for an invalid regex pattern", () => {
    const html = `<script>var fen = "abcdef";</script>`;
    const rules: HtmlExtractRule[] = [
      { type: "script-regex", pattern: "[invalid((" },
    ];
    assert.equal(extractFromHtml(html, rules), null);
  });

  it("returns null when there are no script tags", () => {
    const html = `<div>no scripts here</div>`;
    const rules: HtmlExtractRule[] = [
      { type: "script-regex", pattern: "fen\\s*=\\s*['\"]([^'\"]{10,})['\"]" },
    ];
    assert.equal(extractFromHtml(html, rules), null);
  });
});

// ── meta ──────────────────────────────────────────────────────────────────────

describe("extractFromHtml — meta", () => {
  it("extracts meta content with name before content", () => {
    const html = `<meta name="chess:fen" content="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1">`;
    const rules: HtmlExtractRule[] = [
      { type: "meta", name: "chess:fen" },
    ];
    assert.equal(
      extractFromHtml(html, rules),
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("extracts meta content with content before name", () => {
    const html = `<meta content="8/8/8/4k3/8/4K3/8/8 w - - 0 1" name="chess:fen">`;
    const rules: HtmlExtractRule[] = [
      { type: "meta", name: "chess:fen" },
    ];
    assert.equal(extractFromHtml(html, rules), "8/8/8/4k3/8/4K3/8/8 w - - 0 1");
  });

  it("returns null when meta name does not match", () => {
    const html = `<meta name="description" content="A chess puzzle site">`;
    const rules: HtmlExtractRule[] = [
      { type: "meta", name: "chess:fen" },
    ];
    assert.equal(extractFromHtml(html, rules), null);
  });
});

// ── css-text ──────────────────────────────────────────────────────────────────

describe("extractFromHtml — css-text", () => {
  it("extracts text content of a matching tag", () => {
    const html = `<span>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</span>`;
    const rules: HtmlExtractRule[] = [
      { type: "css-text", selector: "span" },
    ];
    assert.equal(
      extractFromHtml(html, rules),
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("returns null for unsupported complex selector", () => {
    const html = `<div class="fen-box">test content here</div>`;
    const rules: HtmlExtractRule[] = [
      { type: "css-text", selector: "div.fen-box" },
    ];
    // Complex selectors not supported with regex approach — returns null.
    assert.equal(extractFromHtml(html, rules), null);
  });
});

// ── fallthrough and ordering ──────────────────────────────────────────────────

describe("extractFromHtml — rule ordering and fallthrough", () => {
  it("returns the first successful match when multiple rules are provided", () => {
    const html = `
      <div data-fen="first-match-value-here"></div>
      <script>var fen = "second-match-value-here";</script>
    `;
    const rules: HtmlExtractRule[] = [
      { type: "css-attr", selector: "[data-fen]", attribute: "data-fen" },
      { type: "script-regex", pattern: "fen\\s*=\\s*['\"]([^'\"]{10,})['\"]" },
    ];
    assert.equal(extractFromHtml(html, rules), "first-match-value-here");
  });

  it("falls through to the next rule when the first does not match", () => {
    const html = `<script>var fen = "fallback-match-value";</script>`;
    const rules: HtmlExtractRule[] = [
      { type: "css-attr", selector: "[data-fen]", attribute: "data-fen" },
      { type: "script-regex", pattern: "fen\\s*=\\s*['\"]([^'\"]{10,})['\"]" },
    ];
    assert.equal(extractFromHtml(html, rules), "fallback-match-value");
  });

  it("returns null when no rules match", () => {
    const html = `<div>Nothing to extract here.</div>`;
    const rules: HtmlExtractRule[] = [
      { type: "css-attr", selector: "[data-fen]", attribute: "data-fen" },
      { type: "script-regex", pattern: "fen\\s*=\\s*['\"]([^'\"]{10,})['\"]" },
    ];
    assert.equal(extractFromHtml(html, rules), null);
  });

  it("returns null for an empty rules array", () => {
    const html = `<div data-fen="some-fen-value"></div>`;
    assert.equal(extractFromHtml(html, []), null);
  });
});
