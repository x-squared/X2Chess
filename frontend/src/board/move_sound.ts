/**
 * Board move-sound component.
 *
 * Integration API:
 * - `createMoveSoundPlayer({ isSoundEnabled })` returns a `playMoveSound` function.
 *
 * Configuration API:
 * - Sound enablement is controlled by `isSoundEnabled()` callback.
 *
 * Communication API:
 * - Uses audio assets in `public/sounds/chess/`.
 */

export type ChessSoundType =
  | "move"
  | "capture"
  | "castling"
  | "check"
  | "checkmate"
  | "stalemate";

type MoveSoundPlayerDeps = {
  isSoundEnabled: () => boolean;
};

export type MoveSoundPlayer = {
  playMoveSound: (soundType?: ChessSoundType) => Promise<void>;
};

const SOUND_ASSET_BY_TYPE: Record<ChessSoundType, string> = {
    move: "/sounds/chess/move.mp3",
    capture: "/sounds/chess/capture.mp3",
    castling: "/sounds/chess/castling.wav",
    check: "/sounds/chess/check.wav",
    checkmate: "/sounds/chess/checkmate.wav",
    stalemate: "/sounds/chess/stalemate.wav",
};

const isChessSoundType = (value: string): value is ChessSoundType =>
  value in SOUND_ASSET_BY_TYPE;

/**
 * Create move-sound playback capabilities.
 */
export const createMoveSoundPlayer = ({
  isSoundEnabled,
}: MoveSoundPlayerDeps): MoveSoundPlayer => {
  const audioTemplateByType = new Map<ChessSoundType, HTMLAudioElement>();

  /**
   * Get (or create) reusable audio template for one sound type.
   *
   */
  const getAudioTemplate = (soundType: string): HTMLAudioElement | null => {
    if (typeof window === "undefined" || typeof window.Audio !== "function") return null;
    const resolvedType: ChessSoundType = isChessSoundType(soundType) ? soundType : "move";
    const existing = audioTemplateByType.get(resolvedType);
    if (existing) return existing;
    const src = SOUND_ASSET_BY_TYPE[resolvedType];
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.load();
    audioTemplateByType.set(resolvedType, audio);
    return audio;
  };

  /**
   * Play one move sound event from asset library.
   *
   */
  const playMoveSound: MoveSoundPlayer["playMoveSound"] = async (soundType = "move") => {
    if (!isSoundEnabled()) return;
    const template = getAudioTemplate(soundType);
    if (!template) return;
    const node = template.cloneNode(true);
    if (!(node instanceof HTMLAudioElement)) return;
    node.volume = 0.75;
    try {
      await node.play();
    } catch {
      // Ignore playback failures from autoplay constraints or rapid interruptions.
    }
  };

  return { playMoveSound };
};
