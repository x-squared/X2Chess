## 45. Archetype System

### 45.1 What an Archetype Is

An archetype is a formal, versioned definition of a clinical concept — what data a "blood pressure observation" must contain, what data types are used, what units are valid, what terminology codes apply.

Archetypes are stored as JSON Schema (derived from the international openEHR Archetype Definition Language / ADL format):

```json
{
  "archetype_id": "openEHR-EHR-OBSERVATION.blood_pressure.v2",
  "description": "Blood pressure measurement",
  "items": {
    "/data/events/data/items[at0004]/value": {
      "rm_type": "DV_QUANTITY",
      "units": ["mmHg"],
      "range": { "min": 0, "max": 300 }
    },
    "/data/events/data/items[at0005]/value": {
      "rm_type": "DV_QUANTITY",
      "units": ["mmHg"],
      "range": { "min": 0, "max": 200 }
    }
  }
}
```

### 45.2 Archetype Registry

Archetypes are loaded and cached at application startup. No archetype is parsed per request.

```python
class ArchetypeRegistry:
    _cache: dict[str, ArchetypeSchema] = {}

    @classmethod
    def load(cls, path: Path) -> None:
        for f in path.glob("*.json"):
            schema = ArchetypeSchema.model_validate_json(f.read_text())
            cls._cache[schema.archetype_id] = schema

    @classmethod
    def validate(cls, archetype_id: str, content: dict) -> None:
        schema = cls._cache.get(archetype_id)
        if not schema:
            raise UnknownArchetypeError(archetype_id)
        schema.validate(content)   # raises ValidationError if invalid
```

### 45.3 Form Generation

Forms are derived from archetypes via FHIR Questionnaire descriptors — one per archetype. The frontend form engine takes a Questionnaire JSON and renders the form without any form-specific code.

```typescript
// Any clinical form, no bespoke component:
function ClinicalForm({ archetypeId }: { archetypeId: string }) {
  const { data: questionnaire } = useQuery(
    ["questionnaire", archetypeId],
    () => fetchQuestionnaire(archetypeId)
  );
  if (!questionnaire) return <Spinner />;
  return <FormEngine items={questionnaire.item} />;
}
```

Adding a new clinical concept: add an archetype JSON + a Questionnaire JSON. No code change.

---

