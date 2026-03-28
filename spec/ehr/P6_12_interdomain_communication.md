## 54. Inter-Domain Communication

Domains never query each other's schemas. They communicate through events.

```python
# Clinical domain: composition stored → publish event
async def store_composition(episode_id: UUID, data: CompositionInput) -> UUID:
    archetype_registry.validate(data.archetype_id, data.content)
    comp_id = await db.insert_composition(episode_id, data)
    await event_bus.publish("composition.created", {
        "composition_id": str(comp_id),
        "archetype_id": data.archetype_id,
        "episode_id": str(episode_id),
        "patient_id": str(data.patient_id),
        "recorded_at": utcnow().isoformat()
    })
    return comp_id

# Billing domain: listen and derive charges
@on_event("composition.created")
async def handle_composition_for_billing(event: dict) -> None:
    if is_billable(event["archetype_id"]):
        await create_invoice_item(
            episode_id=event["episode_id"],
            source_type="composition",
            source_id=event["composition_id"]
        )

# Projection updater: maintain latest_vitals
@on_event("composition.created")
async def update_vitals_projection(event: dict) -> None:
    if event["archetype_id"] == "vital_signs.v3":
        await refresh_latest_vitals(event["patient_id"])
```

**Transport**: PostgreSQL `LISTEN/NOTIFY` for single-node deployments. NATS or RabbitMQ when scaling horizontally.

---

