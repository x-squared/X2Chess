# P6_21 Device Integration Framework

The strategic case for a tiered browser / Tauri / bridge deployment is made in [P6_20](P6_20_deployment_targets_browser_and_fat_client.md). This chapter specifies the framework that makes that strategy work: how devices are abstracted, how the environment is detected, how each tier integrates with the native layer, and how a new device type is added.

---

## Design Principles

**1. The application never addresses hardware directly.**
All peripheral calls go through a typed device interface. Nothing in component or business logic code knows whether it is running in a browser, a Tauri shell, or alongside a bridge service.

**2. Every device has a browser fallback.**
A degraded but functional behaviour exists for every device type when native access is unavailable. The UI communicates the degradation clearly but does not block the workflow.

**3. Device availability is declared, not assumed.**
Before invoking a device, the application checks availability. Unavailability is a normal state, not an error.

**4. Device state is local; no device state crosses the network.**
Print jobs, scan results, and device events are handled locally on the workstation. Only the clinical outcome (e.g., the scanned barcode value, the confirmed print record) enters the application state and the server.

---

## Environment Detection

On startup, the application resolves its device environment once and caches the result for the session:

```typescript
// src/devices/environment.ts

export type DeviceEnvironment = "tauri" | "bridge" | "browser";

export async function detectDeviceEnvironment(): Promise<DeviceEnvironment> {
  if (typeof window.__TAURI__ !== "undefined") return "tauri";
  if (await isBridgeReachable())               return "bridge";
  return "browser";
}

async function isBridgeReachable(): Promise<boolean> {
  try {
    const r = await fetch("http://localhost:9271/health", { signal: AbortSignal.timeout(300) });
    return r.ok;
  } catch {
    return false;
  }
}
```

The resolved environment is injected into the application's service context (alongside all other service dependencies) at startup. Device implementations are selected once at that point and never re-evaluated mid-session.

---

## Device Abstraction Layer

Each device category is expressed as a TypeScript interface. Implementations for each environment satisfy the interface. The application always depends on the interface, never on an implementation.

### Label Printer

```typescript
export interface LabelPrinter {
  isAvailable(): Promise<boolean>;
  listPrinters(): Promise<PrinterInfo[]>;
  print(job: LabelJob): Promise<PrintResult>;
}

export interface PrinterInfo {
  id: string;
  name: string;
  model: string;
  isDefault: boolean;
  status: "ready" | "busy" | "error" | "offline";
}

export interface LabelJob {
  template: LabelTemplate;   // "patient_wristband" | "specimen" | "medication" | "pharmacy_bag"
  data: Record<string, string>;
  copies: number;
  printerId?: string;        // omit to use default
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: "printer_offline" | "driver_error" | "out_of_media" | "communication_error";
}
```

**Label templates** are defined as ZPL (Zebra Programming Language) or EPL template strings stored in the configuration store, not in code. The template defines the layout; the `data` map fills the variable fields. This means label layouts can be changed without a deployment.

### Document Scanner

```typescript
export interface DocumentScanner {
  isAvailable(): Promise<boolean>;
  listScanners(): Promise<ScannerInfo[]>;
  scan(options: ScanOptions): Promise<ScanResult>;
}

export interface ScanOptions {
  scannerId?: string;
  resolution: 150 | 300;    // dpi — 150 for forms, 300 for documents
  colour: "colour" | "greyscale" | "bw";
  duplex: boolean;
  format: "pdf" | "jpeg";
}

export interface ScanResult {
  success: boolean;
  pages: ScannedPage[];     // one entry per physical page
  error?: "scanner_offline" | "paper_jam" | "feeder_empty" | "cancelled";
}

export interface ScannedPage {
  pageNumber: number;
  dataUrl: string;          // base64-encoded image/PDF data
  widthMm: number;
  heightMm: number;
}
```

### Barcode / RFID Reader

Most USB HID barcode scanners present as keyboard devices and emit the scanned value as keystrokes into the focused input. The browser handles these natively without any special API. The framework's contribution is a **scan capture hook** that distinguishes scanner input from human typing:

```typescript
// src/devices/barcode/useScanCapture.ts

export function useScanCapture(onScan: (value: string) => void) {
  // Scanners emit a complete barcode in < 50 ms followed by Enter.
  // Human typing never produces a complete token in < 50 ms.
  // The hook buffers keystrokes and fires onScan when the timing
  // and terminator pattern match scanner behaviour.
  useEffect(() => {
    const handler = new ScanInputDetector(onScan, {
      minLength: 4,
      maxInterKeyMs: 50,
      terminators: ["Enter"],
    });
    window.addEventListener("keydown", handler.handleKey);
    return () => window.removeEventListener("keydown", handler.handleKey);
  }, [onScan]);
}
```

For RFID readers and Bluetooth scanners that do not present as HID keyboards, native access is required:

```typescript
export interface RfidReader {
  isAvailable(): Promise<boolean>;
  startReading(onTag: (tag: RfidTag) => void): Promise<void>;
  stopReading(): Promise<void>;
}

export interface RfidTag {
  uid: string;
  type: "medication_label" | "patient_wristband" | "staff_badge" | "unknown";
  payload?: string;
}
```

### Smart Card Reader

```typescript
export interface SmartCardReader {
  isAvailable(): Promise<boolean>;
  waitForCard(timeoutMs: number): Promise<SmartCardEvent>;
  readCertificate(): Promise<CertificateInfo>;
}

export type SmartCardEvent =
  | { type: "inserted"; atr: string }
  | { type: "removed" }
  | { type: "timeout" };

export interface CertificateInfo {
  subjectName: string;
  gln: string;           // Swiss GLN — Globale Location Number for HPC
  validFrom: Date;
  validUntil: Date;
  raw: string;           // DER base64 for authentication handshake
}
```

Smart card authentication flows through this interface during login; the result is passed to the authentication service as a credential, not retained by the device layer.

---

## Implementations by Environment

### Tauri Environment

The Tauri Rust backend exposes a command for each device operation. The TypeScript implementations call `invoke`:

```typescript
// src/devices/label_printer/tauri_printer.ts

import { invoke } from "@tauri-apps/api/core";
import type { LabelPrinter, LabelJob, PrintResult, PrinterInfo } from "../interfaces";

export const tauriLabelPrinter: LabelPrinter = {
  isAvailable: () => invoke<boolean>("printer_available"),
  listPrinters: () => invoke<PrinterInfo[]>("printer_list"),
  print: (job: LabelJob) => invoke<PrintResult>("printer_print", { job }),
};
```

On the Rust side, the commands use platform print APIs (Windows: WinSpool / GDI; macOS: CUPS; Linux: CUPS). ZPL templates pass through to the printer raw — Zebra printers accept ZPL as a raw print job without rendering through the OS raster pipeline.

The Rust backend registers available hardware at application start and reports it via `printer_available`. This avoids calling into a driver for every `isAvailable()` check.

### Bridge Environment

The device bridge service runs as a local system service and exposes a WebSocket API on `localhost:9271`. Each device type maps to a WebSocket channel. Authentication uses a session token issued at login — the bridge verifies the token with the application server before accepting commands.

```typescript
// src/devices/label_printer/bridge_printer.ts

import type { LabelPrinter, LabelJob, PrintResult, PrinterInfo } from "../interfaces";
import { bridgeClient } from "../bridge/bridge_client";

export const bridgeLabelPrinter: LabelPrinter = {
  isAvailable: () => bridgeClient.call("printer.available"),
  listPrinters: () => bridgeClient.call<PrinterInfo[]>("printer.list"),
  print: (job: LabelJob) => bridgeClient.call<PrintResult>("printer.print", job),
};
```

The bridge service protocol uses JSON-RPC over WebSocket:

```json
→ { "id": "r42", "method": "printer.print", "params": { "template": "patient_wristband", "data": { … }, "copies": 1 } }
← { "id": "r42", "result": { "success": true, "jobId": "j-7721" } }
```

The bridge service is a small standalone native application (written in Go or Rust) distributed as a Windows/Linux service installer. It has no UI. It reports its version and available devices to the application server on registration so IT can monitor fleet state centrally.

### Browser Environment (Fallback)

Every interface has a browser implementation that uses whatever the browser can do and clearly communicates what it cannot:

```typescript
// src/devices/label_printer/browser_printer.ts

import type { LabelPrinter, LabelJob, PrintResult, PrinterInfo } from "../interfaces";
import { renderLabelAsHtml } from "../label_renderer";

export const browserLabelPrinter: LabelPrinter = {
  isAvailable: () => Promise.resolve(true),   // browser print is always "available"
  listPrinters: () => Promise.resolve([]),    // cannot enumerate printers from browser
  print: async (job: LabelJob): Promise<PrintResult> => {
    const html = renderLabelAsHtml(job);
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return { success: false, error: "communication_error" };
    win.document.write(html);
    win.print();
    win.close();
    return { success: true };
  },
};
```

The browser scanner implementation for RFID simply returns `isAvailable: false`. The component that depends on it renders an informational message and an alternative workflow path (manual barcode entry field).

---

## Device Factory — Wiring It Together

At application startup, a single factory resolves the environment and constructs the concrete implementations:

```typescript
// src/devices/device_factory.ts

import { detectDeviceEnvironment } from "./environment";
import { tauriLabelPrinter } from "./label_printer/tauri_printer";
import { bridgeLabelPrinter } from "./label_printer/bridge_printer";
import { browserLabelPrinter } from "./label_printer/browser_printer";
// … same pattern for all device types

export interface DeviceServices {
  labelPrinter: LabelPrinter;
  documentScanner: DocumentScanner;
  rfidReader: RfidReader;
  smartCardReader: SmartCardReader;
}

export async function createDeviceServices(): Promise<DeviceServices> {
  const env = await detectDeviceEnvironment();

  switch (env) {
    case "tauri":
      return {
        labelPrinter:    tauriLabelPrinter,
        documentScanner: tauriDocumentScanner,
        rfidReader:      tauriRfidReader,
        smartCardReader: tauriSmartCardReader,
      };
    case "bridge":
      return {
        labelPrinter:    bridgeLabelPrinter,
        documentScanner: bridgeDocumentScanner,
        rfidReader:      bridgeRfidReader,
        smartCardReader: bridgeSmartCardReader,
      };
    case "browser":
      return {
        labelPrinter:    browserLabelPrinter,
        documentScanner: browserDocumentScanner,   // fallback: file upload dialog
        rfidReader:      nullRfidReader,           // fallback: always unavailable
        smartCardReader: nullSmartCardReader,       // fallback: always unavailable
      };
  }
}
```

`DeviceServices` is added to the application's service context and provided via React context, making every device implementation available to components without prop-drilling.

---

## Workstation Tier Map

The three tiers map onto physical workstation roles as follows. This map is an input to IT provisioning, not an application configuration — the application detects its tier automatically.

| Workstation role | Tier | Installed components |
|---|---|---|
| Physician workstation | Browser | Browser only |
| Outpatient / consultation room | Browser | Browser only |
| Office / quality / admin | Browser | Browser only |
| Ward nursing station | Tauri | Tauri installer |
| Medication cart terminal | Tauri | Tauri installer |
| Pharmacy dispensing station | Tauri | Tauri installer |
| Ward reception / admission | Tauri | Tauri installer |
| Laboratory workstation | Tauri | Tauri installer |
| Shared / kiosk terminal | Bridge | Bridge service (system service) |
| Locked-down managed device | Bridge | Bridge service (system service) |
| Anaesthesia workstation | Bridge or Tauri | Depends on OS image policy |

Workstations are assigned to tiers by IT during provisioning. A workstation can move between tiers by installing or uninstalling the Tauri application or bridge service — the frontend application requires no reconfiguration.

---

## Adding a New Device Type

When a new peripheral category is introduced (e.g., a signature pad for consent workflows), the steps are:

1. **Define the interface** in `src/devices/interfaces/signature_pad.ts` — the contract that all implementations must satisfy.
2. **Write the Tauri implementation** — add the corresponding Rust command to the Tauri backend.
3. **Write the bridge implementation** — add the method to the bridge service protocol and implement it in the bridge service codebase.
4. **Write the browser fallback** — typically a modal that asks the user to complete the action another way (e.g., paper form + scan later).
5. **Register in the factory** — add the new service to `DeviceServices` and all three `switch` branches in `createDeviceServices`.
6. **Add to service context** — the new device is available to all components immediately.

No component code changes until a component actually needs to use the new device. The factory pattern means new device types are additive, not disruptive.

---

## Error Handling and Resilience

Device failures must never block a clinical workflow. The general pattern:

```typescript
async function printWristband(patient: Patient, printer: LabelPrinter) {
  const available = await printer.isAvailable();
  if (!available) {
    showToast("Label printer not available — print from nurses' station", "warning");
    auditLog("wristband_print_deferred", { patient_id: patient.id, reason: "printer_unavailable" });
    return;
  }
  const result = await printer.print(buildWristbandJob(patient));
  if (!result.success) {
    showToast(`Print failed: ${friendlyError(result.error)}`, "error");
    auditLog("wristband_print_failed", { patient_id: patient.id, error: result.error });
    return;
  }
  auditLog("wristband_printed", { patient_id: patient.id, job_id: result.jobId });
}
```

Key rules:
- `isAvailable()` before every print or scan — never assume the device is ready.
- A failed print is a toast and an audit entry, not a thrown exception and a broken workflow.
- The clinical record is updated only on confirmed success. A deferred print does not mark the wristband as printed.
- All device interactions are audit-logged with the clinical context (patient_id, episode_id where applicable).
