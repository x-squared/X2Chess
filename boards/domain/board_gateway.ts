/**
 * board_gateway — I/O injection interface for physical board hardware.
 *
 * Integration API:
 * - `BoardGateway` — implemented by Tauri adapters, injected into board adapters.
 * - `SerialHandle`, `BleHandle` — transport handles returned by the gateway.
 * - `PortInfo`, `BlePeripheral` — discovery result types.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Interface definitions only; no I/O.
 */

// ── Discovery types ───────────────────────────────────────────────────────────

export type PortInfo = {
  /** OS path (e.g. "/dev/ttyUSB0", "COM3"). */
  path: string;
  /** Human-readable description from the OS. */
  description?: string;
  /** USB vendor ID in hex (e.g. "0403"). */
  vid?: string;
  /** USB product ID in hex (e.g. "e0e0"). */
  pid?: string;
};

export type BlePeripheral = {
  /** Platform-specific peripheral identifier. */
  id: string;
  /** Advertised device name, if available. */
  name?: string;
  /** RSSI in dBm, if available. */
  rssi?: number;
};

// ── Transport handles ─────────────────────────────────────────────────────────

export interface SerialHandle {
  write(data: Uint8Array): Promise<void>;
  /** Registers a callback for incoming data bytes. Returns unsubscribe. */
  onData(handler: (data: Uint8Array) => void): () => void;
  close(): Promise<void>;
}

export interface BleHandle {
  writeCharacteristic(uuid: string, data: Uint8Array): Promise<void>;
  /** Registers a callback for GATT notifications. Returns unsubscribe. */
  onCharacteristic(uuid: string, handler: (data: Uint8Array) => void): () => void;
  disconnect(): Promise<void>;
}

// ── Gateway interface ─────────────────────────────────────────────────────────

/** I/O injection interface implemented by Tauri adapters. */
export interface BoardGateway {
  /** List available serial ports. */
  listPorts(): Promise<PortInfo[]>;
  /** Open a serial port at the given baud rate. */
  openPort(path: string, baudRate: number): Promise<SerialHandle>;
  /** BLE: scan for peripherals advertising the given service UUIDs. */
  bleScan(serviceUuids: string[]): Promise<BlePeripheral[]>;
  /** BLE: connect to a peripheral and return a handle. */
  bleConnect(peripheralId: string): Promise<BleHandle>;
}
