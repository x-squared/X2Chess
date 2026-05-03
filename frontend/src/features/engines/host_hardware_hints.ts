/**
 * host_hardware_hints — host RAM / CPU hints for engine UCI tooltips (Hash, Threads).
 *
 * Reads logical processor count from `navigator` when available; optional desktop shell
 * (`host_hardware_summary` IPC) supplies accurate total RAM on Tauri builds.
 */

import type { UciOption } from "../../../../parts/engines/src/domain/uci_types";

/** Resolved snapshot used when composing Hash / Threads help text. */
export type HostHardwareSnapshot = {
  logicalProcessors: number | null;
  totalRamMegabytes: number | null;
};

/**
 * Reads coarse CPU / RAM hints exposed by the browser (no desktop IPC).
 *
 * @returns Snapshot fields may be null when the runtime does not expose them.
 */
export const readNavigatorHostSnapshot = (): HostHardwareSnapshot => {
  const logicalProcessors: number | null =
    typeof navigator !== "undefined" &&
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : null;

  const navExt: Navigator & { deviceMemory?: number } =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number })
      : ({} as Navigator & { deviceMemory?: number });
  const deviceMemoryGiB: number | undefined =
    typeof navExt.deviceMemory === "number" && navExt.deviceMemory > 0
      ? navExt.deviceMemory
      : undefined;

  const totalRamMegabytes: number | null =
    deviceMemoryGiB !== undefined ? Math.round(deviceMemoryGiB * 1024) : null;

  return {
    logicalProcessors,
    totalRamMegabytes,
  };
};

/**
 * Clamps a heuristic Hash size (MB) to the engine spin control range when known.
 *
 * @param suggestedMb Heuristic value (~25% RAM).
 * @param opt UCI option metadata from the engine.
 * @returns Rounded MB within `[opt.min, opt.max]` for spin options, else the heuristic.
 */
export const clampHashMegabytesToEngineSpin = (suggestedMb: number, opt: UciOption): number => {
  if (opt.type !== "spin") {
    return suggestedMb;
  }
  const minV: number = Number(opt.min);
  const maxV: number = Number(opt.max);
  return Math.min(maxV, Math.max(minV, Math.round(suggestedMb)));
};

/**
 * Clamps a heuristic thread count to the engine spin range when known.
 *
 * @param suggestedThreads Heuristic value (e.g. logical CPUs minus two for the OS).
 * @param opt UCI option metadata from the engine.
 */
export const clampThreadsToEngineSpin = (suggestedThreads: number, opt: UciOption): number => {
  if (opt.type !== "spin") {
    return suggestedThreads;
  }
  const minV: number = Number(opt.min);
  const maxV: number = Number(opt.max);
  return Math.min(maxV, Math.max(minV, Math.round(suggestedThreads)));
};

/**
 * Derives suggested Hash (MB) and Threads from total RAM and CPU count.
 *
 * @param hints RAM may be null when unknown.
 * @param opt Option row metadata (used for spin clamps).
 */
export const suggestedEngineLimits = (
  hints: HostHardwareSnapshot,
  opt: UciOption,
): { hashMegabytes: number | null; threads: number | null } => {
  const ramMb: number | null = hints.totalRamMegabytes;
  const cores: number | null = hints.logicalProcessors;

  const rawHash: number | null =
    ramMb !== null ? Math.max(16, Math.round(ramMb * 0.25)) : null;
  const hashMegabytes: number | null =
    rawHash !== null ? clampHashMegabytesToEngineSpin(rawHash, opt) : null;

  const rawThreads: number | null =
    cores !== null ? Math.max(1, cores - 2) : null;
  const threads: number | null =
    rawThreads !== null ? clampThreadsToEngineSpin(rawThreads, opt) : null;

  return { hashMegabytes, threads };
};
