/**
 * useRulesRefresh — background rules-server fetch at app startup.
 *
 * Fetches the rules manifest from the GitHub Pages rules server at startup
 * (non-blocking, all failures silent).  When a newer version of the web-import
 * rules is found, the updated rules are stored in localStorage and returned
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
 * - Cache: `remoteRulesCacheStore` in localStorage.
 *
 * Communication API:
 * - Outbound: `fetch()` to the GitHub Pages rules manifest.
 * - Side effect: writes updated rules to localStorage on successful fetch.
 */

import { useState, useEffect } from "react";
import type { WebImportRule } from "../resources/web_import/web_import_types";
import { remoteRulesCacheStore } from "../runtime/remote_rules_store";

// ── Constants ────────────────────────────────────────────────────────────────

const RULES_MANIFEST_URL =
  "https://x-squared.github.io/X2Chess/rules/manifest.json";

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

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the remote rules manifest and return any downloaded rule overrides.
 *
 * Returns `null` while the fetch is in progress.  Returns an empty array if
 * the fetch fails, the remote version is not newer, or there are no rules.
 *
 * @returns Updated `WebImportRule[]` on a successful newer-version fetch, or `null` while pending.
 */
export const useRulesRefresh = (): WebImportRule[] | null => {
  const [remoteRules, setRemoteRules] = useState<WebImportRule[] | null>(null);

  useEffect((): void => {
    void (async (): Promise<void> => {
      const cachedRules = (): WebImportRule[] => remoteRulesCacheStore.read()?.rules ?? [];

      try {
        const manifestResponse = await fetch(RULES_MANIFEST_URL);
        if (!manifestResponse.ok) {
          setRemoteRules(cachedRules());
          return;
        }

        const manifest = await manifestResponse.json() as RulesManifest;
        const webImportSpec = manifest.rules?.webImport;
        if (!webImportSpec) {
          setRemoteRules(cachedRules());
          return;
        }

        const cachedVersion = remoteRulesCacheStore.read()?.version ?? 0;
        if (webImportSpec.version <= cachedVersion) {
          setRemoteRules(cachedRules());
          return;
        }

        // Fetch the updated rule file.
        const base = RULES_MANIFEST_URL.replace(/\/[^/]+$/, "/");
        const rulesUrl = webImportSpec.url.startsWith("http")
          ? webImportSpec.url
          : base + webImportSpec.url;

        const rulesResponse = await fetch(rulesUrl);
        if (!rulesResponse.ok) {
          setRemoteRules(cachedRules());
          return;
        }

        const rules = await rulesResponse.json() as WebImportRule[];
        if (!Array.isArray(rules)) {
          setRemoteRules(cachedRules());
          return;
        }

        remoteRulesCacheStore.write({ version: webImportSpec.version, rules });
        setRemoteRules(rules);
      } catch {
        // All failures are silent — use whatever is cached.
        setRemoteRules(cachedRules());
      }
    })();
  }, []); // run once on mount

  return remoteRules;
};
