# P6_20 Deployment Targets — Browser and Fat Client

## The Default: Browser-First

The EHR runs in the browser. This is the default, not a compromise. A browser-based application delivers several properties that matter deeply in an institution-wide clinical system:

- **Zero client deployment**: a new version goes live on the server; every workstation sees it on the next page load. In a hospital with hundreds of workstations across multiple facilities, eliminating the client deployment cycle is operationally significant.
- **Always current**: there is no version fragmentation across the estate. The nurse on ward 3A and the physician in the outpatient clinic run exactly the same software.
- **No installation permissions required**: clinical workstations are typically locked down. A browser requires no local installation and no local administrator rights.
- **Cross-platform**: the same application runs on Windows, macOS, and Linux workstations, and on tablets, without platform-specific builds.
- **Standard security model**: the browser sandbox is well-understood, continuously hardened, and requires no custom security audit of a native application layer.

The browser-first default covers the majority of EHR workflows: documentation, order entry, medication review, pathway management, scheduling, quality reporting. For all of these, a modern browser is fully sufficient.

---

## What the Browser Cannot Do

The browser's sandbox model, which gives it most of its security and deployment advantages, also restricts access to local hardware. Several categories of peripherals are directly relevant to clinical operation:

### Label Printers

Every clinical workstation that handles specimens, medications, or patient identification requires a label printer. Patient wristbands, specimen labels, medication bags, and pharmacy dispensing labels are physical artefacts produced continuously during clinical operation. Label printers are typically connected via USB or a local network print queue and require platform-specific drivers. The browser's print API produces document pages — it cannot address a Zebra or Dymo label printer directly, target a specific label format, or suppress the browser's print dialog.

### Document Scanners

Consent forms, external referral letters, insurance documents, and patient-supplied records must be scanned into the episode record. Scanners expose TWAIN or WIA interfaces on Windows. There is no browser API for scanner access.

### Medical Devices at the Bedside

Point-of-care devices — glucometers, ECG machines, pulse oximeters, infusion pumps — increasingly offer data output via USB or serial interfaces. The Web Serial API exists but has inconsistent support, requires explicit user gesture for each connection, and does not support background data capture. Devices that continuously stream data (bedside monitors feeding the PDMS, P4_04) cannot operate through a browser page that may be backgrounded or navigated away from.

### Barcode and RFID Readers

Medication administration safety workflows rely on scanning: patient wristband scan, medication scan, nurse badge scan — the "five rights" verified electronically. USB HID barcode scanners can function as keyboard emulators and work in the browser without any special API. However, RFID readers and Bluetooth scanners require native interfaces.

### Smart Card and Badge Authentication

Some Swiss institutions use smart card authentication (HPC — Heilmittelberufsausweis or equivalent). Smart card readers expose PKCS#11 or PC/SC interfaces. The browser has no access to these.

---

## The Device Landscape by Workstation Type

Not every workstation needs peripheral access. The need is concentrated:

| Workstation context | Peripherals needed | Browser sufficient? |
|---|---|---|
| Physician consulting room | None in most cases | Yes |
| Nurse documentation station | Label printer, barcode scanner | Marginal |
| Nurse medication cart | Label printer, barcode scanner, RFID | No |
| Ward reception / admission | Label printer, document scanner, ID reader | No |
| Pharmacy dispensing | Label printer, barcode scanner, RFID | No |
| Laboratory | Label printer, specimen scanner, LIS interface | No |
| Operating theatre scrub station | Minimal — mostly documentation | Yes |
| Anaesthesia workstation | Device data capture (monitor, pump) | No |
| Radiology | Primarily DICOM viewer — separate application | N/A |
| Quality manager / office | None | Yes |

The pattern is clear: peripheral access is concentrated at the care-delivery frontier — nursing stations, pharmacies, laboratories, and procedural environments. Administrative and analytical roles need none of it.

---

## The Tauri Option

Tauri is a framework for building desktop applications that use a native OS webview to render a web frontend, with a Rust process providing native OS access. This is directly relevant because:

1. The EHR frontend is already a Vite/React application — the same codebase that runs in the browser can run inside a Tauri shell with no changes to the application code.
2. The Tauri shell's Rust backend can call any OS API, driver, or native library — USB, serial, print spooler, scanner APIs, smart card — and expose the result to the frontend via a typed `invoke` interface.
3. The deployment model is a thin installer that wraps the web application. The frontend is still served from the application server; the shell is a local host for the webview and a bridge to native APIs.
4. Updates to the application (frontend changes) still deploy via the server. Only changes to the native bridge layer require a client-side update, which is far less frequent.

The pattern is identical to the dual-target architecture used in X2Chess: a single frontend codebase with platform detection at the native-API call sites. On a plain browser, the call returns a "not available" response and the UI degrades gracefully (e.g., the label print button triggers a browser print fallback). On a Tauri-wrapped workstation, the call succeeds and the native device is addressed directly.

```typescript
// Device bridge — abstraction over browser vs. Tauri
export interface LabelPrinter {
  print(job: LabelJob): Promise<PrintResult>;
  isAvailable(): Promise<boolean>;
}

// Tauri implementation — calls Rust backend
export const tauriLabelPrinter: LabelPrinter = {
  isAvailable: () => invoke<boolean>("printer_available"),
  print: (job) => invoke<PrintResult>("print_label", { job }),
};

// Browser fallback — opens browser print dialog with formatted label
export const browserLabelPrinter: LabelPrinter = {
  isAvailable: () => Promise.resolve(true),
  print: (job) => openBrowserPrintDialog(job),
};

// Resolved at runtime
export const labelPrinter: LabelPrinter =
  window.__TAURI__ ? tauriLabelPrinter : browserLabelPrinter;
```

The `__TAURI__` global is injected by the Tauri shell and absent in a plain browser. The frontend never needs to be explicitly configured for one target or the other — it detects at runtime.

---

## The Alternative: Device Bridge Service

A lighter alternative to a full Tauri application is a **device bridge service** — a small native process that runs as a local system service on workstations that need peripheral access. The browser application communicates with it over localhost WebSockets or HTTP.

```
Browser ──── WebSocket (localhost:9271) ──── Device Bridge Service (native)
                                                     │
                                               USB / Serial / Print APIs
```

Advantages over Tauri:
- No change to the deployment model — the application remains a pure browser application
- The bridge service can be deployed and updated independently of the frontend
- Multiple browser tabs or users on the same workstation share one bridge instance

Disadvantages:
- An additional component to install, monitor, and update on each workstation
- Local port binding introduces a minor security surface (must be restricted to localhost, authenticated)
- More moving parts to diagnose when a peripheral is not responding

The device bridge is a viable approach for institutions that have an existing fleet management infrastructure and want to keep browser purity. It is more operationally complex than Tauri in exchange for a cleaner architectural boundary.

---

## Recommended Architecture

The two approaches are not mutually exclusive. The recommended strategy is a **tiered deployment model**:

**Tier 1 — Pure browser** (majority of workstations)
All roles that do not require peripheral access. Physicians, quality managers, administrators, outpatient clinicians. No local component. Zero deployment overhead.

**Tier 2 — Tauri-wrapped workstation** (device-intensive contexts)
Nursing medication carts, pharmacy dispensing stations, ward reception, laboratory, admission. A Tauri installer is deployed to these workstations by the IT department, wrapping the same frontend. The Rust bridge provides label printing, scanning, RFID, and smart card access. The frontend application is otherwise identical to Tier 1.

**Tier 3 — Dedicated peripheral bridge** (legacy or shared workstations)
Where Tauri cannot be installed (locked-down environments, shared kiosk terminals) and the device bridge service can be deployed as a system service instead. The browser frontend targets the localhost bridge API rather than the Tauri invoke channel.

The frontend detects its environment at startup and selects the appropriate device implementation:

```typescript
type DeviceEnvironment = "tauri" | "bridge" | "browser";

function detectEnvironment(): DeviceEnvironment {
  if (window.__TAURI__)          return "tauri";
  if (isBridgeReachable())       return "bridge";
  return "browser";
}
```

All three environments run the same frontend application code. The device implementations are injected via the service context at startup — the application logic that triggers a label print does not know or care which environment it is running in.

---

## Implications for the Frontend Architecture

The dual-target requirement imposes one rule on the frontend codebase: **no direct native API calls in component or business logic code**. All hardware access goes through the device abstraction layer. This mirrors the principle already established for the I/O gateway in the data layer (P6_17): native calls are injected, not embedded.

Components that trigger peripheral operations receive a device interface as a prop or context value:

```tsx
function MedicationAdminPanel({ printer }: { printer: LabelPrinter }) {
  const handlePrint = async () => {
    const result = await printer.print(buildMedLabel(medication));
    if (!result.success) showToast("Print failed — check printer connection", "warning");
  };
  …
}
```

This keeps components testable (the printer can be a stub in tests), environment-agnostic, and free of conditional logic branching on `__TAURI__`.

---

## Open Questions

- **Tauri update mechanism**: when the Rust bridge layer needs updating (new device driver, security patch), what is the rollout mechanism? Tauri supports auto-update via its updater plugin; this must integrate with the institution's patch management process.
- **Multi-user workstations**: some ward workstations are shared by multiple clinicians who log in and out during a shift. Tauri's single-process model must handle session switching cleanly — the Rust bridge holds no session state, only device handles.
- **Mobile tablets**: iOS and Android cannot run Tauri. Peripheral access on tablets (barcode scanning, NFC) is handled through the native mobile applications (P6_09) with their own device APIs, not through this architecture.
- **Printer driver management**: label printer drivers remain a local IT responsibility. The Tauri bridge calls the OS print API; the driver must already be installed and the printer configured. The bridge can report driver availability but cannot install drivers.
