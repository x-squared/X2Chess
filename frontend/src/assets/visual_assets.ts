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

type VisualAsset = {
  key: string;
  cssVar: string;
  remoteUrl: string;
  localUrl: string;
};

const VISUAL_ASSETS: VisualAsset[] = [
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

const toCssUrlValue = (url: string): string => `url("${String(url).replace(/"/g, '\\"')}")`;

const readAssetCache = (cacheKey: string): string | null => {
  try {
    return window.localStorage.getItem(`${VISUAL_ASSET_STORAGE_PREFIX}${cacheKey}`);
  } catch {
    return null;
  }
};

const writeAssetCache = (cacheKey: string, value: string): void => {
  try {
    window.localStorage.setItem(`${VISUAL_ASSET_STORAGE_PREFIX}${cacheKey}`, value);
  } catch {
    // Ignore quota/private-mode storage errors and keep runtime fallback behavior.
  }
};

const asDataUrl = (blob: Blob): Promise<string> => new Promise<string>((resolve, reject): void => {
  const reader: FileReader = new FileReader();
  reader.onload = (): void => resolve(String(reader.result || ""));
  reader.onerror = (): void => reject(reader.error || new Error("Failed to read resource blob."));
  reader.readAsDataURL(blob);
});

const fetchAssetDataUrl = async (url: string): Promise<string> => {
  const response: Response = (await Promise.race([
    window.fetch(url, { cache: "no-store", mode: "cors" }),
    new Promise<Response>((_resolve, reject): void => {
      window.setTimeout((): void => reject(new Error("Asset request timed out.")), VISUAL_ASSET_FETCH_TIMEOUT_MS);
    }),
  ])) as Response;
  if (!response.ok) {
    throw new Error(`Failed to load asset: ${url}`);
  }
  const blob: Blob = await response.blob();
  const dataUrl: string = await asDataUrl(blob);
  if (!dataUrl) throw new Error(`Empty asset data: ${url}`);
  return dataUrl;
};

const applyVisualAsset = (asset: VisualAsset, cssUrlValue: string): void => {
  if (!document.documentElement) return;
  document.documentElement.style.setProperty(asset.cssVar, cssUrlValue);
};

const hydrateVisualAsset = async (asset: VisualAsset): Promise<void> => {
  try {
    const dataUrl: string = await fetchAssetDataUrl(asset.remoteUrl);
    writeAssetCache(asset.key, dataUrl);
    applyVisualAsset(asset, toCssUrlValue(dataUrl));
    return;
  } catch {
    // Fall through to cached and bundled local fallback sources.
  }

  const cached: string | null = readAssetCache(asset.key);
  if (cached) {
    applyVisualAsset(asset, toCssUrlValue(cached));
    return;
  }

  applyVisualAsset(asset, toCssUrlValue(asset.localUrl));
};

export const hydrateVisualAssets = async (): Promise<void> => {
  await Promise.allSettled(VISUAL_ASSETS.map((asset: VisualAsset): Promise<void> => hydrateVisualAsset(asset)));
};
