/**
 * Visual Assets module.
 *
 * Integration API:
 * - Primary exports from this module: `hydrateVisualAssets`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through DOM, browser storage, external I/O; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

const VISUAL_ASSET_STORAGE_PREFIX = "chess-app:visual-asset:v2:";
const VISUAL_ASSET_FETCH_TIMEOUT_MS = 4000;

const VISUAL_ASSETS = [
  {
    key: "board-image",
    cssVar: "--board-background-image",
    remoteUrl: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_board_openings.svg",
    localUrl: "/board-assets/img/boards/merida-blue.svg",
  },
  {
    key: "piece-wp",
    cssVar: "--piece-wp-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wP.png",
    localUrl: "/canvaschess/img/pieces/merida/wp.svg",
  },
  {
    key: "piece-wn",
    cssVar: "--piece-wn-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wN.png",
    localUrl: "/canvaschess/img/pieces/merida/wn.svg",
  },
  {
    key: "piece-wb",
    cssVar: "--piece-wb-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wB.png",
    localUrl: "/canvaschess/img/pieces/merida/wb.svg",
  },
  {
    key: "piece-wr",
    cssVar: "--piece-wr-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wR.png",
    localUrl: "/canvaschess/img/pieces/merida/wr.svg",
  },
  {
    key: "piece-wq",
    cssVar: "--piece-wq-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wQ.png",
    localUrl: "/canvaschess/img/pieces/merida/wq.svg",
  },
  {
    key: "piece-wk",
    cssVar: "--piece-wk-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wK.png",
    localUrl: "/canvaschess/img/pieces/merida/wk.svg",
  },
  {
    key: "piece-bp",
    cssVar: "--piece-bp-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bP.png",
    localUrl: "/canvaschess/img/pieces/merida/bp.svg",
  },
  {
    key: "piece-bn",
    cssVar: "--piece-bn-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bN.png",
    localUrl: "/canvaschess/img/pieces/merida/bn.svg",
  },
  {
    key: "piece-bb",
    cssVar: "--piece-bb-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bB.png",
    localUrl: "/canvaschess/img/pieces/merida/bb.svg",
  },
  {
    key: "piece-br",
    cssVar: "--piece-br-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bR.png",
    localUrl: "/canvaschess/img/pieces/merida/br.svg",
  },
  {
    key: "piece-bq",
    cssVar: "--piece-bq-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bQ.png",
    localUrl: "/canvaschess/img/pieces/merida/bq.svg",
  },
  {
    key: "piece-bk",
    cssVar: "--piece-bk-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bK.png",
    localUrl: "/canvaschess/img/pieces/merida/bk.svg",
  },
];

/**
 * Convert URL string to CSS `url(...)` value.
 *
 * @param {string} url - Asset URL or data URL.
 * @returns {string} CSS-compatible url() wrapper.
 */
const toCssUrlValue = (url: any): any => `url("${String(url).replace(/"/g, '\\"')}")`;

/**
 * Read cached asset data URL from localStorage.
 *
 * @param {string} cacheKey - Asset cache key suffix.
 * @returns {string|null} Cached data URL or null when unavailable.
 */
const readAssetCache = (cacheKey: any): any => {
  try {
    return window.localStorage.getItem(`${VISUAL_ASSET_STORAGE_PREFIX}${cacheKey}`);
  } catch {
    return null;
  }
};

/**
 * Write asset data URL to localStorage cache.
 *
 * @param {string} cacheKey - Asset cache key suffix.
 * @param {string} value - Data URL payload.
 */
const writeAssetCache = (cacheKey: any, value: any): any => {
  try {
    window.localStorage.setItem(`${VISUAL_ASSET_STORAGE_PREFIX}${cacheKey}`, value);
  } catch {
    // Ignore quota/private-mode storage errors and keep runtime fallback behavior.
  }
};

/**
 * Convert Blob to data URL.
 *
 * @param {Blob} blob - Binary payload fetched from remote source.
 * @returns {Promise<string>} Data URL.
 */
const asDataUrl = (blob: any): any => new Promise((resolve: any, reject: any): any => {
  const reader = new FileReader();
  reader.onload = (): any => resolve(String(reader.result || ""));
  reader.onerror = (): any => reject(reader.error || new Error("Failed to read resource blob."));
  reader.readAsDataURL(blob);
});

/**
 * Fetch remote asset and convert it to data URL with timeout protection.
 *
 * @param {string} url - Remote asset URL.
 * @returns {Promise<string>} Data URL fetched from remote source.
 */
const fetchAssetDataUrl = async (url: any): Promise<any> => {
  const response = (await Promise.race([
    window.fetch(url, { cache: "no-store", mode: "cors" }),
    new Promise<Response>((_: any, reject: any): any => {
      window.setTimeout((): any => reject(new Error("Asset request timed out.")), VISUAL_ASSET_FETCH_TIMEOUT_MS);
    }),
  ])) as Response;
  if (!response.ok) {
    throw new Error(`Failed to load asset: ${url}`);
  }
  const blob = await response.blob();
  const dataUrl = await asDataUrl(blob);
  if (!dataUrl) throw new Error(`Empty asset data: ${url}`);
  return dataUrl;
};

/**
 * Apply one visual asset to CSS variable on `:root`.
 *
 * @param {{cssVar: string}} asset - Asset descriptor containing CSS variable key.
 * @param {string} cssUrlValue - CSS `url(...)` value.
 */
const applyVisualAsset = (asset: any, cssUrlValue: any): any => {
  if (!document.documentElement) return;
  document.documentElement.style.setProperty(asset.cssVar, cssUrlValue);
};

/**
 * Hydrate one asset with remote -> cache -> local fallback order.
 *
 * @param {{key: string, cssVar: string, remoteUrl: string, localUrl: string}} asset - Asset descriptor.
 */
const hydrateVisualAsset = async (asset: any): Promise<any> => {
  try {
    const dataUrl = await fetchAssetDataUrl(asset.remoteUrl);
    writeAssetCache(asset.key, dataUrl);
    applyVisualAsset(asset, toCssUrlValue(dataUrl));
    return;
  } catch {
    // Fall through to cached and bundled local fallback sources.
  }

  const cached = readAssetCache(asset.key);
  if (cached) {
    applyVisualAsset(asset, toCssUrlValue(cached));
    return;
  }

  // Use bundled local path directly. This avoids data-URL issues for SVGs that
  // may include nested asset references and keeps fallback behavior deterministic.
  applyVisualAsset(asset, toCssUrlValue(asset.localUrl));
};

/**
 * Hydrate all configured visual assets.
 *
 * @returns {Promise<void>} Settles after all asset attempts complete.
 */
export const hydrateVisualAssets = async (): Promise<any> => {
  await Promise.allSettled(VISUAL_ASSETS.map((asset: any): any => hydrateVisualAsset(asset)));
};
