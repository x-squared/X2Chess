/**
 * useRulesRefresh — background rules-server fetch at app startup.
 *
 * Fetches the rules manifest from the GitHub Pages rules server at startup
 * (non-blocking, all failures silent).  When a newer version of the web-import
 * rules is found, the updated rules are stored in `localStorage` and returned
 * so the caller can refresh the active web-import rule registry.
 *
 * Integration API:
 * - `const remoteRules = useRulesRefresh()` — call once in `AppShell`.
 * - `remoteRules` is `null` until the fetch completes; then an array of
 *   `WebImportRule` objects (may be empty if no updates or fetch failed).
 * - Pass `remoteRules` to `buildRegistry()` instead of `[]` to include
 *   any downloaded rule overrides.
 *
 * Configuration API:
 * - Rules manifest URL: `RULES_MANIFEST_URL` constant below.
 * - Cache key: `RULES_CACHE_KEY` in `localStorage`.
 *
 * Communication API:
 * - Outbound: `fetch()` to the GitHub Pages rules manifest.
 * - Side effect: writes updated rules to `localStorage` on successful fetch.
 */

import { useState, useEffect } from "react";
import type { WebImportRule } from "../resources/web_import/web_import_types";

// ── Constants ────────────────────────────────────────────────────────────────

const RULES_MANIFEST_URL =
  "https://x-squared.github.io/X2Chess/rules/manifest.json";

const RULES_CACHE_KEY = "x2chess.webImportRules.v1";
const RULES_VERSION_KEY = "x2chess.webImportRules.version";

// ── Manifest type ─────────────────────────────────────────────────────────────

type RulesManifest = {
  version: number;
  updated?: string;
  rules: {
    webImport?: {
      version: number;
      url: string;
    };
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const loadCachedRules = (): WebImportRule[] => {
  try {
    const raw = localStorage.getItem(RULES_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WebImportRule[]) : [];
  } catch {
    return [];
  }
};

const saveCachedRules = (rules: WebImportRule[], version: number): void => {
  try {
    localStorage.setItem(RULES_CACHE_KEY, JSON.stringify(rules));
    localStorage.setItem(RULES_VERSION_KEY, String(version));
  } catch {
    // localStorage may be full or unavailable — ignore.
  }
};

const loadCachedVersion = (): number => {
  try {
    return Number(localStorage.getItem(RULES_VERSION_KEY) ?? "0");
  } catch {
    return 0;
  }
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the remote rules manifest and return any downloaded rule overrides.
 *
 * Returns `null` while the fetch is in progress.  Returns an empty array if
 * the fetch fails, the remote version is not newer, or there are no rules.
 * Returns the fetched `WebImportRule[]` on a successful update.
 */
export const useRulesRefresh = (): WebImportRule[] | null => {
  const [remoteRules, setRemoteRules] = useState<WebImportRule[] | null>(null);

  useEffect((): void => {
    void (async (): Promise<void> => {
      try {
        const manifestResponse = await fetch(RULES_MANIFEST_URL);
        if (!manifestResponse.ok) {
          setRemoteRules(loadCachedRules());
          return;
        }

        const manifest = await manifestResponse.json() as RulesManifest;
        const webImportSpec = manifest.rules?.webImport;
        if (!webImportSpec) {
          setRemoteRules(loadCachedRules());
          return;
        }

        const cachedVersion = loadCachedVersion();
        if (webImportSpec.version <= cachedVersion) {
          // Already up to date — return the cached rules.
          setRemoteRules(loadCachedRules());
          return;
        }

        // Fetch the updated rule file.
        const base = RULES_MANIFEST_URL.replace(/\/[^/]+$/, "/");
        const rulesUrl = webImportSpec.url.startsWith("http")
          ? webImportSpec.url
          : base + webImportSpec.url;

        const rulesResponse = await fetch(rulesUrl);
        if (!rulesResponse.ok) {
          setRemoteRules(loadCachedRules());
          return;
        }

        const rules = await rulesResponse.json() as WebImportRule[];
        if (!Array.isArray(rules)) {
          setRemoteRules(loadCachedRules());
          return;
        }

        saveCachedRules(rules, webImportSpec.version);
        setRemoteRules(rules);
      } catch {
        // All failures are silent — use whatever is cached.
        setRemoteRules(loadCachedRules());
      }
    })();
  }, []); // run once on mount

  return remoteRules;
};
