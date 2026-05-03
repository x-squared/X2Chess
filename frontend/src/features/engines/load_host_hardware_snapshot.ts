/**
 * load_host_hardware_snapshot — async host RAM/CPU snapshot for engine option tooltips.
 *
 * On Tauri, prefers `host_hardware_summary` (accurate RAM). Falls back to
 * `readNavigatorHostSnapshot` when IPC fails or in the browser-only build.
 */

import { isTauri, tauriInvoke } from "../../platform/desktop/tauri_ipc_bridge";
import { log } from "../../logger";
import {
  readNavigatorHostSnapshot,
  type HostHardwareSnapshot,
} from "./host_hardware_hints";

type TauriHostHardwareDto = {
  logicalProcessors: number;
  totalMemoryMegabytes: number;
};

/**
 * Loads CPU/RAM figures for engine configure tooltips.
 *
 * @returns Always returns a snapshot (navigator-only fields may still be null).
 */
export const loadHostHardwareSnapshot = async (): Promise<HostHardwareSnapshot> => {
  const nav: HostHardwareSnapshot = readNavigatorHostSnapshot();
  if (!isTauri()) {
    return nav;
  }
  try {
    const dto: TauriHostHardwareDto = await tauriInvoke<TauriHostHardwareDto>(
      "host_hardware_summary",
    );
    return {
      logicalProcessors: dto.logicalProcessors,
      totalRamMegabytes: dto.totalMemoryMegabytes,
    };
  } catch (err: unknown) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === "string") {
      message = err;
    } else {
      message = JSON.stringify(err);
    }
    log.error("load_host_hardware_snapshot", "host_hardware_summary invoke failed", {
      message,
    });
    return nav;
  }
};
