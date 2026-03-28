## 12. Anatomical Body Views

### 12.1 The Body View as a Spatial Query Interface

An anatomical body view holds no clinical data. It is a **spatial index** — a rendered map that serves as a query interface into the composition store. When a clinician taps the right knee, the system queries for all compositions referencing that anatomical location. The view colours regions where data exists; clicking a region opens the relevant records.

All body site references in compositions use **SNOMED CT body structure concepts**. SNOMED's body structure hierarchy supports subsumption: a query for "knee structure" returns compositions coded to "right knee", "left knee", "medial meniscus of right knee", etc. The same subsumption engine used for coded clinical values (§46) applies here.

### 12.2 Multiple View Assets

Different clinical specialties require different anatomical maps. Each is an SVG asset with regions mapped to SNOMED CT codes:

| View | Specialties | Regions |
|---|---|---|
| Full body anterior / posterior | General, orthopaedics, dermatology | ~80 major surface regions |
| Lateral (left/right) | Orthopaedics, neurology | Spine, limb lateral surfaces |
| Hand — dorsal / palmar | Orthopaedics, rheumatology, hand surgery | Individual bones, joints, tendons |
| Foot — dorsal / plantar | Orthopaedics, podiatry, diabetic foot | Metatarsals, toes, heel |
| Dental odontogram | Dentistry | Individual teeth, surfaces (mesial, distal, buccal, lingual, occlusal) |
| Skin surface map | Dermatology, wound care | Body surface zones for lesion mapping |
| Eye — anterior / posterior segment | Ophthalmology | Cornea, lens, retinal zones |
| Dermatome map | Neurology, pain | Dermatomal zones (C2–S5) |

### 12.3 Generic Component Architecture

A single generic component handles all views:

```typescript
type BodyRegion = {
  regionId: string;          // SVG element id
  snomedCode: string;        // SNOMED CT body structure concept
  label: string;
};

type BodyViewProps = {
  svgAsset: string;          // path to SVG map
  regions: BodyRegion[];     // region → SNOMED mapping
  patientId: string;
  onRegionSelect: (snomedCode: string, label: string) => void;
};

function BodyView({ svgAsset, regions, patientId, onRegionSelect }: BodyViewProps) {
  const { data: activeRegions } = useQuery(
    ["body_regions", patientId],
    () => fetchActiveBodyRegions(patientId)  // returns set of SNOMED codes with data
  );

  // Colours SVG regions where data exists; handles hover and click
  return (
    <InteractiveSvg
      src={svgAsset}
      regions={regions}
      activeRegions={activeRegions}
      onRegionClick={(region) => onRegionSelect(region.snomedCode, region.label)}
    />
  );
}
```

Adding a new view: provide an SVG file and a region mapping JSON. No new component code.

### 12.4 Region Annotation Layer

Beyond querying existing compositions, clinicians can annotate directly on the body view — placing a marker, drawing a wound outline, or noting pain radiation. These annotations are stored as compositions with:
- The anatomical site (SNOMED CT code)
- The annotation type (marker, outline, area)
- Geometric data (coordinates relative to the SVG viewport, normalised 0–1)
- Clinical content (archetype-defined: wound measurement, pain score, lesion description)

Stored geometry is SVG-asset-agnostic — normalised coordinates are mapped to whichever SVG is rendered, including different-sized displays. Wound outlines captured on a tablet render correctly on a phone.

---

