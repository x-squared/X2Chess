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

/**
 * Create move-sound playback capabilities.
 *
 * @param {object} deps - Host dependencies.
 * @param {Function} deps.isSoundEnabled - Callback returning current sound-enabled state.
 * @returns {{playMoveSound: Function}} Move-sound playback methods.
 */
export const createMoveSoundPlayer = ({ isSoundEnabled }) => {
  const SOUND_ASSET_BY_TYPE = {
    move: "/sounds/chess/move.mp3",
    capture: "/sounds/chess/capture.mp3",
    castling: "/sounds/chess/castling.wav",
    check: "/sounds/chess/check.wav",
    checkmate: "/sounds/chess/checkmate.wav",
    stalemate: "/sounds/chess/stalemate.wav",
  };
  const audioTemplateByType = new Map();

  /**
   * Get (or create) reusable audio template for one sound type.
   *
   * @param {string} soundType - Sound type key.
   * @returns {HTMLAudioElement|null} Audio template element or null when unsupported.
   */
  const getAudioTemplate = (soundType) => {
    if (typeof window === "undefined" || typeof window.Audio !== "function") return null;
    const resolvedType = SOUND_ASSET_BY_TYPE[soundType] ? soundType : "move";
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
   * @param {string} soundType - One of: move/capture/castling/check/checkmate/stalemate.
   */
  const playMoveSound = async (soundType = "move") => {
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
