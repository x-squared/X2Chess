## 29. Logistics

### 29.1 Patient and Material Transport

- Transport orders generated automatically from appointment and procedure scheduling: patient transport triggered N minutes before appointment start; material transport triggered by order confirmation
- Manual transport requests also supported from any clinical workstation or bedside terminal
- Transport optimisation: open requests grouped by origin/destination and urgency; routing algorithm minimises total transport time; displayed as an optimised run list to transport staff
- Real-time status of each transport order: requested / accepted / en route / delivered / cancelled — visible on the ward dashboard and on the requesting clinician's task view
- Bidirectional status updates: transport staff update status from mobile device; changes propagate immediately to the requesting ward
- Appointment rescheduling propagates to linked transport orders: if an appointment moves, the transport order is automatically adjusted or flagged for re-planning
- Integration with external transport services (e.g. Logbuch transport system): bidirectional interface showing bed status, material status, and medication-in-transit; the EHR transport module can replace or supplement the existing Logbuch system depending on configuration

### 29.2 Inventory, Materials, and Medications

- Digital ordering process for non-catalogue items with required approval workflow
- Real-time material availability: current stock levels and projected stock (based on scheduled procedures and consumption rate) visible per ward and per central store
- Automated inventory management: stock alerts when items fall below reorder point; automatic reorder triggered via SAP integration (GLN/SSCC standard item codes)
- Material status in EHR synchronised with SAP material master data (material master matching)
- Cross-ward stock locator: any user can query which store or ward holds a specific item
- Cross-ward requisition: order materials from another ward's stock with approval workflow
- Consignment stock management: consignment agreements with suppliers maintained; consumption automatically triggers billing event to supplier and replenishment order
- External system integration: SAP via GLN (Global Location Number) and SSCC (Serial Shipping Container Code)
- Regulatory traceability: batch and serial number tracking from receipt to patient use; automated recall identification (which patients received a recalled lot) — see also implant recall §23.3
- Scan-based consumption capture: barcode or RFID scan at point of care captures item, lot number, and patient; charge is generated automatically (Scan & Go)
- Image recognition for automated stock counting: camera-based shelf scanning generates reorder suggestions
- OR case cart management: dynamic procedure-linked picklist generated from OR schedule; cart contents adjusted as procedure changes propagate; picklist includes standard packs (§22.4.2) and ad-hoc additions

### 29.3 Cleaning

- Cleaning orders triggered automatically: on patient admission (room preparation), on patient discharge (terminal clean), on OR sign-out (OR room clean), and on isolation order activation (enhanced clean protocol)
- Manual cleaning requests from any workstation or bedside terminal
- Cleaning order scheduling: urgency and estimated duration considered; orders dispatched to available cleaning staff via the transport/task routing module
- Bed-level status: each bed and each bed position within a shared room has an independent cleaning status (clean / pending clean / cleaning in progress / ready for patient)
- Cleaning status visible on the bed management board and in the ward overview
- Materials and supply orders for cleaning tasks: linked to the inventory module; supply request status shown
- Prospective planning: cleaning schedule feeds the bed pre-planning (§28.15) — a bed flagged for terminal clean is excluded from pre-allocation until clean status is confirmed
- Post-OR clean trigger: generated automatically at OR sign-out with infection control metadata (isolation type, causative organisms) to determine cleaning protocol level

### 29.4 Sterile Goods (CSSD / AEMP)

- Sterile goods tracked throughout the production lifecycle: soiled return → decontamination → inspection → packaging → sterilisation → release → storage → dispatch → use → documentation on patient
- CSSD/AEMP status visible in the EHR: current production step of each set shown (e.g. "tray 4712-A: in autoclave, cycle 00441, ETA 14:30")
- Bidirectional data flow between EHR and CSSD system: EHR sends request for specific tray; CSSD sends back status updates and confirmation of dispatch
- RFID integration: trays tracked via RFID tags through each production step; RFID reader events trigger status updates automatically
- Instrument set documented on patient: when a sterile set is used in a procedure, the set ID, sterilisation lot number, and expiry date are recorded in the procedure record (§22.5.8)
- Utilisation analysis: configurable report showing for each instrument set: use frequency, current location/status, ordered-but-not-yet-available count, min/max stock in circulation

### 29.5 Hotel Services

- Meal ordering for staff (configurable staff meal categories separate from patient meal system)
- Additional patient services ordering and billing: TV, phone, newspaper, private nursing, premium amenities — ordered via patient app or bedside terminal; charges applied to billing record by insurance class entitlement
- Patient service entitlement overview: what services the patient is entitled to under their insurance class is shown to ward staff and in the patient app; out-of-scope services are flagged with self-pay cost before ordering

### 29.6 Patient Belongings and Valuables

- Belongings inventory on admission: items recorded (description, quantity); image capture (tablet camera) with confirmation/signature by patient or representative
- Valuables stored in ward safe: item tracked with safe identifier and handover chain
- Automatic transport request for return of belongings at discharge
- Alert/reminder to ward staff at discharge: checklist item confirms all recorded belongings have been returned and acknowledged by patient

### 29.7 Blood Products and Patient Blood Management

- Blood sample collection triggers transport order to blood bank automatically; urgency level maps to transport priority
- Urgent blood orders flagged on transport screen; blood bank notified simultaneously
- Patient Blood Management (PBM) protocol integrated: haemoglobin thresholds (per evidence-based PBM guidelines) trigger CDS prompts before transfusion order is accepted (e.g. "Hb 9.2 g/dL — PBM guideline recommends optimisation before transfusion; proceed?")
- Transfusion order requires documented indication; post-transfusion Hb check reminder generated automatically
- Blood product administration documented in MAR with product identifiers (donation number, blood group, expiry) scanned at bedside; mismatch blocked

---

